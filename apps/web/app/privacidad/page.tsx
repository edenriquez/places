import Link from "next/link";
import { LegalPage, List, Mail, Section } from "@/components/legal";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Aviso de privacidad",
  description: "Qué datos personales trata Entre Lugares, para qué los usa, con quién los comparte, qué cookies usa y cómo ejercer tus derechos ARCO.",
  path: "/privacidad",
});

const UPDATED = "8 de octubre de 2026";

const TOC = [
  { id: "responsable", label: "Quién es responsable" },
  { id: "datos", label: "Qué datos tratamos" },
  { id: "finalidades", label: "Para qué los usamos" },
  { id: "estadisticas", label: "Estadísticas de uso y ubicación" },
  { id: "publico", label: "Lo que se publica" },
  { id: "compartir", label: "Con quién los compartimos" },
  { id: "cookies", label: "Cookies" },
  { id: "conservacion", label: "Cuánto tiempo los guardamos" },
  { id: "arco", label: "Tus derechos (ARCO) y cómo ejercerlos" },
  { id: "menores", label: "Menores de edad" },
  { id: "cambios", label: "Cambios a este aviso" },
];

/** Aviso de privacidad integral (LFPDPPP). También es la URL de política de privacidad en Google Auth Platform. */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Aviso de privacidad"
      updated={UPDATED}
      toc={TOC}
      other={{ href: "/terminos", label: "Términos y condiciones" }}
      intro={
        <p>
          En <b>entrelugares</b> cuidamos tus datos personales. Este aviso explica qué datos tratamos cuando usas el sitio,
          para qué, con quién los compartimos y cómo puedes ejercer tus derechos, conforme a la Ley Federal de Protección de
          Datos Personales en Posesión de los Particulares. <b>Puedes usar entrelugares sin crear una cuenta.</b>
        </p>
      }
    >
      <Section id="responsable" title="1. Quién es responsable">
        <p>
          <b>entrelugares</b> (“entrelugares”, “nosotros”) es responsable del tratamiento de tus datos personales.
          Para cualquier tema de privacidad, incluido el ejercicio de tus derechos, escríbenos a <Mail subject="Privacidad" />.
        </p>
      </Section>

      <Section id="datos" title="2. Qué datos tratamos">
        <List>
          <li><b>Si solo exploras (sin cuenta):</b> datos de uso anónimos ligados a un identificador aleatorio (ver sección 4) y la zona que eliges para buscar eventos.</li>
          <li><b>Si usas “Mi ubicación”:</b> la ubicación de tu dispositivo, solo si tú das permiso en el navegador.</li>
          <li><b>Si entras con Google:</b> tu nombre, correo electrónico y foto de perfil de Google.</li>
          <li><b>Lo que haces con tu cuenta:</b> eventos que guardas, eventos que marcas con “Me interesa” y los gustos que eliges en tu perfil (categorías, con quién sales y tu pueblo).</li>
          <li><b>Si publicas un evento:</b> el flyer, la descripción, el municipio, el nombre de quien organiza, el teléfono o WhatsApp de contacto y el link que escribas.</li>
          <li><b>Si nos escribes:</b> tu correo y lo que nos cuentes (por ejemplo, al reportar un dato incorrecto).</li>
        </List>
        <p>No pedimos ni tratamos datos personales sensibles (salud, religión, origen étnico, preferencias sexuales, etcétera) ni datos financieros: entrelugares no cobra ni vende boletos.</p>
      </Section>

      <Section id="finalidades" title="3. Para qué los usamos">
        <p><b>Finalidades necesarias</b> para darte el servicio:</p>
        <List>
          <li>Mostrarte los eventos cercanos a la zona que elegiste.</li>
          <li>Crear y mantener tu cuenta: guardar eventos, marcar los que te interesan y recordar tus gustos.</li>
          <li>Recibir, revisar y publicar los eventos que envías, y mostrarte su estado en tu perfil.</li>
          <li>Responder tus mensajes y corregir datos que nos reportes.</li>
          <li>Mantener el sitio seguro y funcionando (por ejemplo, detectar abusos o fallas).</li>
        </List>
        <p><b>Finalidades adicionales</b>, que no son necesarias para el servicio:</p>
        <List>
          <li>Recomendarte primero los eventos que creemos que te van a gustar, según tu zona y tus gustos.</li>
          <li>Elaborar <b>estadísticas agregadas</b> (por ejemplo: “120 personas vieron este evento, 60% desde el celular, la mayoría de Cuautla”) que compartimos con organizadores y comercios. Nunca incluyen tu nombre, tu correo ni datos que te identifiquen.</li>
          <li>Entender cómo se usa entrelugares para mejorarlo.</li>
        </List>
        <p>
          Si no quieres que usemos tus datos para estas finalidades adicionales, escríbenos a <Mail subject="No usar mis datos para finalidades adicionales" />.
          Negarte no afecta el servicio que te damos.
        </p>
      </Section>

      <Section id="estadisticas" title="4. Estadísticas de uso y ubicación">
        <p>
          Para saber qué eventos le interesan a la gente, registramos qué páginas se visitan y qué botones se usan (por ejemplo
          “Cómo llegar” o “Compartir”). Cada registro va ligado a un <b>identificador aleatorio</b> guardado en una cookie de este sitio.
          Si entraste con tu cuenta, el registro también se asocia a tu cuenta.
        </p>
        <p>
          <b>No guardamos tu dirección IP.</b> De ella solo deducimos y guardamos la ciudad, el estado y el país aproximados, y una
          ubicación aproximada (redondeada a alrededor de 1 km). También guardamos el tipo de dispositivo (celular o computadora),
          el sitio desde el que llegaste y, si el link lo trae, la campaña de origen.
        </p>
        <p>
          Si usas “Mi ubicación”, las coordenadas se guardan en una cookie de tu navegador para buscar eventos cerca. Cuando no hay un
          pueblo de nuestro catálogo a menos de 15 km, ese punto de búsqueda también queda en las estadísticas de uso. Puedes elegir un
          pueblo o un estado en lugar de usar tu ubicación.
        </p>
      </Section>

      <Section id="publico" title="5. Lo que se publica">
        <p>
          Cuando publicas un evento, el flyer, la descripción, quién organiza, el teléfono o WhatsApp de contacto y el link que nos
          diste <b>se muestran públicamente</b> en la ficha del evento, para que la gente pueda informarse y contactar a quien organiza.
          No escribas datos de contacto que no quieras que sean públicos.
        </p>
        <p>
          El botón “Me interesa” muestra en el evento cuántas personas lo marcaron, nunca quiénes. Tus eventos guardados y tus gustos solo
          los ves tú.
        </p>
      </Section>

      <Section id="compartir" title="6. Con quién los compartimos">
        <p><b>No vendemos tus datos.</b> Los tratan, solo por encargo nuestro y para operar el servicio, estos proveedores:</p>
        <List>
          <li><b>Supabase:</b> base de datos, cuentas y almacenamiento de flyers.</li>
          <li><b>Vercel:</b> alojamiento del sitio y la ubicación aproximada a partir de la conexión.</li>
          <li><b>Google:</b> inicio de sesión, si eliges entrar con Google.</li>
          <li><b>Asistentes de inteligencia artificial</b> que usamos para leer flyers y capturar eventos. Solo reciben el contenido del evento.</li>
          <li><b>Proveedores de mapas</b> (OpenFreeMap / OpenStreetMap): al ver un mapa, tu navegador les pide las imágenes del mapa de la zona que estás viendo.</li>
        </List>
        <p>
          Algunos de estos proveedores guardan la información en servidores fuera de México, principalmente en Estados Unidos, con medidas
          de seguridad equivalentes. A organizadores y comercios solo les damos estadísticas agregadas y anónimas. Solo compartiríamos
          datos personales con una autoridad si una ley o una orden fundada nos obliga.
        </p>
        <p>
          Si abres un link externo desde un evento (WhatsApp, Google Maps, Waze, redes sociales o el sitio del organizador), ese servicio
          trata tus datos según su propio aviso de privacidad.
        </p>
      </Section>

      <Section id="cookies" title="7. Cookies">
        <List>
          <li><b>el_vid:</b> identificador aleatorio para las estadísticas de uso (1 año).</li>
          <li><b>el_loc:</b> la zona o la ubicación que elegiste para buscar eventos (6 meses).</li>
          <li><b>Sesión:</b> mantiene tu sesión iniciada si entras con Google; se borra al cerrar sesión.</li>
        </List>
        <p>No usamos cookies de publicidad ni de redes sociales. Puedes borrar las cookies desde tu navegador en cualquier momento; el sitio sigue funcionando, aunque tendrás que volver a elegir tu zona.</p>
      </Section>

      <Section id="conservacion" title="8. Cuánto tiempo los guardamos">
        <List>
          <li><b>Estadísticas de uso:</b> se borran automáticamente a los 13 meses.</li>
          <li>
            <b>Cuenta, guardados, “Me interesa” y gustos:</b> mientras tengas tu cuenta. Al borrarla se eliminan; las estadísticas de uso
            que ya se habían registrado se quedan hasta cumplir sus 13 meses, sin forma de ligarlas a tu nombre o correo.
          </li>
          <li><b>Eventos publicados:</b> se quedan como parte de la agenda histórica. Si tú lo enviaste, puedes pedirnos que lo quitemos o que borremos tus datos de contacto.</li>
        </List>
      </Section>

      <Section id="arco" title="9. Tus derechos (ARCO) y cómo ejercerlos">
        <p>
          Tienes derecho a <b>acceder</b> a tus datos, <b>rectificarlos</b>, <b>cancelarlos</b> (incluido borrar tu cuenta) u <b>oponerte</b> a
          su uso. También puedes <b>revocar tu consentimiento</b> o <b>limitar</b> el uso de tus datos.
        </p>
        <p>
          Escríbenos a <Mail subject="Derechos ARCO" /> desde el correo de tu cuenta (o, si no tienes cuenta, el correo con el que nos
          contactaste). Indica qué derecho quieres ejercer y sobre qué datos. Te respondemos en un máximo de <b>20 días hábiles</b> y, si
          procede, lo aplicamos dentro de los 15 días hábiles siguientes.
        </p>
        <p>
          Si crees que no atendimos tu solicitud correctamente, puedes acudir a la autoridad de protección de datos personales
          (Secretaría Anticorrupción y Buen Gobierno).
        </p>
      </Section>

      <Section id="menores" title="10. Menores de edad">
        <p>
          Cualquier persona puede consultar la agenda sin dar datos. Para crear una cuenta o publicar un evento debes ser mayor de edad,
          o hacerlo con permiso y supervisión de tu madre, padre o tutor.
        </p>
      </Section>

      <Section id="cambios" title="11. Cambios a este aviso">
        <p>
          Si cambiamos este aviso, publicaremos la nueva versión en esta página con su fecha de actualización. Si el cambio es importante
          (por ejemplo, una finalidad nueva), también lo avisaremos en el sitio. El uso del sitio también se rige por
          los <Link href="/terminos" className="font-medium text-ink underline">Términos y condiciones</Link>.
        </p>
      </Section>
    </LegalPage>
  );
}
