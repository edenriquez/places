"""Adaptador genérico para sitios web (carteleras de secretarías de cultura, portales municipales).

config (jsonb en sources.config):
  {"item_selector": "article", "image_selector": "img", "link_selector": "a", "text_selector": null,
   "render": false}
Si render=true usa Playwright; si no, httpx + BeautifulSoup.
"""

from __future__ import annotations

from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

from ..config import settings
from .base import Adapter, FoundItem, snapshot


class WebsiteAdapter(Adapter):
    kind = "website"

    def _html(self, url: str) -> str:
        if self.config.get("render"):
            from playwright.sync_api import sync_playwright

            with sync_playwright() as p:
                b = p.chromium.launch(headless=settings.playwright_headless)
                page = b.new_page(user_agent=settings.scrape_user_agent)
                page.goto(url, wait_until="networkidle", timeout=60000)
                html = page.content()
                b.close()
                return html
        r = httpx.get(url, timeout=60, follow_redirects=True, headers={"User-Agent": settings.scrape_user_agent})
        r.raise_for_status()
        return r.text

    def fetch(self) -> list[FoundItem]:
        url = self.source["url"]
        html = self._html(url)
        snapshot(str(self.source["id"]), "page.html", html.encode())
        soup = BeautifulSoup(html, "lxml")
        item_sel = self.config.get("item_selector", "article")
        img_sel = self.config.get("image_selector", "img")
        link_sel = self.config.get("link_selector", "a")
        text_sel = self.config.get("text_selector")
        items: list[FoundItem] = []
        seen: set[str] = set()
        for node in soup.select(item_sel):
            img = node.select_one(img_sel)
            if not img:
                continue
            src = img.get("data-src") or img.get("src")
            if not src:
                continue
            src = urljoin(url, src)
            if src in seen:
                continue
            seen.add(src)
            a = node.select_one(link_sel)
            link = urljoin(url, a["href"]) if a and a.get("href") else None
            text_node = node.select_one(text_sel) if text_sel else node
            text = text_node.get_text(" ", strip=True)[:2000] if text_node else None
            items.append(FoundItem(image_url=src, post_url=link, text=text))
        return items
