"""Adaptador para páginas públicas de Facebook (vista móvil) con Playwright.

Frágil por diseño: Facebook cambia el DOM y puede pedir login. Estrategia:
1. Abrir m.facebook.com/<page> con user agent móvil (y storage_state de una cuenta dedicada si existe).
2. Hacer scroll N veces, recolectar <img> grandes dentro de artículos y el texto del post.
3. Guardar snapshot del HTML. Si no se encuentra nada, registrar error legible en sources.last_error.

Alternativa cuando esto falla: pedir a la página que te agregue como rol (plan, Capa 6).
"""

from __future__ import annotations

import re

from .base import Adapter, FoundItem, snapshot

IMG_MIN_SIDE = 400


class FacebookPageAdapter(Adapter):
    kind = "facebook_page"

    def fetch(self) -> list[FoundItem]:
        from playwright.sync_api import sync_playwright

        from ..config import settings

        url = self.source["url"].rstrip("/")
        m = re.search(r"facebook\.com/([^/?#]+)", url)
        handle = m.group(1) if m else url
        mobile = f"https://m.facebook.com/{handle}"
        scrolls = int(self.config.get("scrolls", 6))
        items: list[FoundItem] = []

        with sync_playwright() as p:
            browser = p.webkit.launch(headless=settings.playwright_headless)
            ctx_kwargs = {
                "user_agent": settings.scrape_user_agent,
                "viewport": {"width": 390, "height": 844},
                "locale": "es-MX",
            }
            if settings.facebook_storage_state:
                ctx_kwargs["storage_state"] = settings.facebook_storage_state
            ctx = browser.new_context(**ctx_kwargs)
            page = ctx.new_page()
            page.goto(mobile, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(3000)
            # cerrar diálogos de login/cookies si aparecen
            for sel in ("div[aria-label='Cerrar']", "div[aria-label='Close']", "[data-cookiebanner='accept_button']"):
                try:
                    page.locator(sel).first.click(timeout=1500)
                except Exception:
                    pass
            for _ in range(scrolls):
                page.mouse.wheel(0, 2500)
                page.wait_for_timeout(1800)
            html = page.content()
            snapshot(str(self.source["id"]), "page.html", html.encode())

            posts = page.locator("article, div[role='article'], div[data-tracking-duration-id]")
            count = min(posts.count(), 60)
            seen: set[str] = set()
            for i in range(count):
                post = posts.nth(i)
                try:
                    text = post.inner_text(timeout=2000)
                except Exception:
                    text = ""
                link = None
                try:
                    href = post.locator("a[href*='/posts/'], a[href*='story_fbid'], a[href*='/photos/']").first.get_attribute("href", timeout=1000)
                    if href:
                        link = href if href.startswith("http") else f"https://m.facebook.com{href}"
                except Exception:
                    pass
                imgs = post.locator("img")
                for j in range(min(imgs.count(), 6)):
                    img = imgs.nth(j)
                    try:
                        src = img.get_attribute("src", timeout=1000) or ""
                        w = int(img.get_attribute("width", timeout=500) or 0)
                        h = int(img.get_attribute("height", timeout=500) or 0)
                    except Exception:
                        continue
                    if not src.startswith("http") or "emoji" in src or "static" in src:
                        continue
                    if (w and w < IMG_MIN_SIDE) or (h and h < IMG_MIN_SIDE):
                        continue
                    if "scontent" not in src and "fbcdn" not in src:
                        continue
                    key = src.split("?")[0]
                    if key in seen:
                        continue
                    seen.add(key)
                    items.append(FoundItem(image_url=src, post_url=link, text=text[:2000] or None))
            browser.close()
        return items
