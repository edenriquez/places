import { BackButton } from "@/components/back-button";

export const metadata = { title: "Aviso de privacidad" };

const UPDATED = "24 de septiembre de 2026";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 text-[18px] font-bold">{children}</h2>;
}

/** Aviso de privacidad (LFPDPPP). También es la URL de política de privacidad en Google Auth Platform. */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-[720px] px-5 pb-20 pt-6 text-[15px] leading-relaxed text-ink-2 [&_b]:text-ink [&_li]:mt-1.5">
      <BackButton className="grid h-10 w-10 place-items-center rounded-full border border-line hover:bg-bg-2" />
      <h1 className="mt-5 text-[28px] font-bold leading-tight text-ink">Aviso de privacidad</h1>
      <p className="mt-1 text-[13px]">Última actualización: {UPDATED}</p>

      <p className="mt-6">
        <b>entrelugares</b> (en adelante, “entrelugares”) es responsable del tratamiento de los datos personales que nos
        proporcionas, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.
        Contacto: <a href="mailto:hola@entrelugares.mx" className="font-medium text-ink underline">hola@entrelugares.mx</a>.
      </p>

      <H2>Qué datos tratamos</H2>
      <ul className="mt-2 list-disc pl-5">
        <li><b>Sin cuenta:</b> puedes usar entrelugares sin darnos datos personales. Medimos el uso de forma anónima (ver “Estadísticas de uso”).</li>
        <li><b>Si entras con Google:</b> tu nombre, correo y foto de perfil de Google.</li>
        <li><b>Lo que haces con tu cuenta:</b> eventos guardados, eventos que te interesan y los gustos que eliges en tu perfil (categorías, con quién sales, tu pueblo).</li>
        <li><b>Si publicas un evento:</b> el flyer, la descripción y los datos de contacto y del organizador que escribas en el formulario.</li>
      </ul>

      <H2>Estadísticas de uso</H2>
      <p className="mt-2">
        Para saber qué eventos le interesan a la gente y mostrar a los organizadores cómo les va, registramos qué páginas se
        visitan y qué botones se usan (por ejemplo “Cómo llegar” o “Compartir”). Lo hacemos con un <b>identificador aleatorio</b> guardado
        en una cookie de este sitio, que no revela quién eres. <b>No guardamos tu dirección IP</b>: solo la ciudad y el estado
        aproximados que se deducen de ella, el tipo de dispositivo (celular o computadora) y el sitio desde el que llegaste.
        Estos datos se borran a los 13 meses.
      </p>

      <H2>Para qué los usamos</H2>
      <ul className="mt-2 list-disc pl-5">
        <li>Darte el servicio: guardar tus eventos, mostrarte lo que te interesa y publicar los eventos que envías.</li>
        <li>Mejorar entrelugares y recomendar eventos según tu zona y tus gustos.</li>
        <li>
          Elaborar <b>estadísticas agregadas</b> (por ejemplo: “120 personas vieron este evento, 60% desde el celular, la mayoría
          de Cuautla”) que compartimos con organizadores y comercios. Estas estadísticas <b>nunca</b> incluyen tu nombre, correo ni ningún dato
          que te identifique.
        </li>
      </ul>

      <H2>Con quién los compartimos</H2>
      <p className="mt-2">
        No vendemos tus datos. Los guardan proveedores que nos dan infraestructura (Supabase para la base de datos, Vercel para
        el sitio y Google para el inicio de sesión), solo para operar el servicio. A organizadores y comercios solo les damos estadísticas
        agregadas y anónimas.
      </p>

      <H2>Cookies</H2>
      <ul className="mt-2 list-disc pl-5">
        <li><b>el_vid:</b> identificador aleatorio para las estadísticas de uso (1 año).</li>
        <li><b>el_loc:</b> la zona que elegiste para buscar eventos (6 meses).</li>
        <li><b>Sesión:</b> mantiene tu sesión iniciada si entras con Google.</li>
      </ul>
      <p className="mt-2">Puedes borrarlas desde tu navegador en cualquier momento; el sitio sigue funcionando.</p>

      <H2>Tus derechos (ARCO)</H2>
      <p className="mt-2">
        Puedes pedir acceso, rectificación, cancelación u oposición al uso de tus datos, o borrar tu cuenta, escribiendo a{" "}
        <a href="mailto:hola@entrelugares.mx?subject=Derechos ARCO" className="font-medium text-ink underline">hola@entrelugares.mx</a>.
        Te respondemos en un máximo de 20 días hábiles.
      </p>

      <H2>Cambios</H2>
      <p className="mt-2">Si cambiamos este aviso, publicaremos la nueva versión en esta página con su fecha de actualización.</p>
    </main>
  );
}
