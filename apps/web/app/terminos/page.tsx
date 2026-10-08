import Link from "next/link";
import { LegalPage, List, Mail, Section } from "@/components/legal";
import { pageMetadata } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Términos y condiciones",
  description: "Reglas para usar Entre Lugares: qué ofrece la agenda, la exactitud de los eventos, las cuentas, cómo publicar un evento y qué contenido no se permite.",
  path: "/terminos",
});

const UPDATED = "8 de octubre de 2026";

const TOC = [
  { id: "servicio", label: "Qué es entrelugares" },
  { id: "aceptacion", label: "Aceptación" },
  { id: "informacion", label: "La información de los eventos" },
  { id: "cuenta", label: "Tu cuenta" },
  { id: "publicar", label: "Publicar un evento" },
  { id: "prohibido", label: "Lo que no se permite" },
  { id: "terceros", label: "Organizadores y servicios de terceros" },
  { id: "estadisticas", label: "Estadísticas para organizadores" },
  { id: "propiedad", label: "Propiedad intelectual" },
  { id: "responsabilidad", label: "Responsabilidad" },
  { id: "cambios", label: "Cambios y suspensión" },
  { id: "ley", label: "Ley aplicable y contacto" },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Términos y condiciones"
      updated={UPDATED}
      toc={TOC}
      other={{ href: "/privacidad", label: "Aviso de privacidad" }}
      intro={
        <p>
          Estos términos explican las reglas para usar <b>entrelugares</b>: la agenda, las cuentas y la publicación de eventos.
          Están escritos para entenderse a la primera; si algo no queda claro, escríbenos a <Mail subject="Términos y condiciones" />.
        </p>
      }
    >
      <Section id="servicio" title="1. Qué es entrelugares">
        <p>
          entrelugares es una agenda gratuita de ferias, fiestas, conciertos, mercados, talleres y otros eventos en pueblos de Morelos,
          Estado de México, Puebla y la Ciudad de México. Te mostramos qué hay cerca, cuándo, dónde, cuánto cuesta y cómo llegar.
        </p>
        <p>
          <b>No organizamos los eventos ni vendemos boletos.</b> Cualquier pago, reservación o compra la haces directamente con quien
          organiza.
        </p>
      </Section>

      <Section id="aceptacion" title="2. Aceptación">
        <p>
          Al usar el sitio aceptas estos términos y el <Link href="/privacidad" className="font-medium text-ink underline">Aviso de privacidad</Link>.
          Si no estás de acuerdo, no uses el sitio. Para crear una cuenta o publicar un evento debes ser mayor de edad, o hacerlo con permiso
          y supervisión de tu madre, padre o tutor.
        </p>
      </Section>

      <Section id="informacion" title="3. La información de los eventos">
        <p>
          La información viene de flyers, convocatorias y publicaciones de los organizadores, y de calendarios de fiestas tradicionales.
          La revisamos antes de publicarla, pero <b>los organizadores pueden cambiar fechas, horarios, precios o lugares, o cancelar, sin
          avisarnos</b>.
        </p>
        <List>
          <li>Las fiestas que se repiten cada año aparecen con <b>fecha estimada</b> hasta que se confirma la fecha real.</li>
          <li>Las distancias y los tiempos de camino son aproximados.</li>
          <li>Antes de salir, confirma con quien organiza, sobre todo si vas lejos o el evento tiene costo.</li>
        </List>
        <p>
          Si ves un dato incorrecto, usa “Reportar un dato incorrecto” en el evento o escríbenos a <Mail subject="Dato incorrecto" />. Lo
          corregimos lo antes posible.
        </p>
      </Section>

      <Section id="cuenta" title="4. Tu cuenta">
        <p>
          Puedes explorar todo sin cuenta. Con una cuenta (entrando con Google) puedes guardar eventos, marcar “Me interesa”, elegir tus
          gustos y publicar eventos. Eres responsable de lo que se haga con tu cuenta; si crees que alguien más la usa, avísanos.
        </p>
        <p>Puedes pedir que borremos tu cuenta cuando quieras escribiendo a <Mail subject="Borrar mi cuenta" />.</p>
      </Section>

      <Section id="publicar" title="5. Publicar un evento">
        <p>Publicar es gratis. Al enviar un evento:</p>
        <List>
          <li>Confirmas que la información es verdadera y que tienes derecho a difundir el evento y su flyer (porque lo organizas o porque quien lo organiza lo hizo público para difundirlo).</li>
          <li>
            Nos das permiso, gratuito y sin exclusividad, para mostrar, adaptar (recortar, redimensionar, extraer el texto) y difundir el
            flyer y los datos del evento en entrelugares y al compartirlo en redes, mensajería, buscadores y asistentes digitales, mientras el evento
            esté publicado y como parte de la agenda histórica.
          </li>
          <li>Aceptas que el nombre de quien organiza, el teléfono o WhatsApp y el link que escribas se muestren públicamente en la ficha.</li>
          <li>Entiendes que revisamos cada envío y que podemos corregir datos, completar la ficha, rechazarla o retirarla, sin obligación de publicar.</li>
        </List>
        <p>Si eres el organizador y quieres corregir o quitar un evento publicado, escríbenos a <Mail subject="Corregir o quitar un evento" />.</p>
      </Section>

      <Section id="prohibido" title="6. Lo que no se permite">
        <List>
          <li>Eventos falsos, engañosos o que ya no existen, o información para estafar o cobrar por algo que no se va a dar.</li>
          <li>Contenido ilegal, violento, discriminatorio, sexual explícito o que promueva actividades peligrosas.</li>
          <li>Flyers o imágenes de otras personas sin derecho a usarlos, o datos personales de terceros sin su permiso.</li>
          <li>Publicidad que no sea un evento, spam o envíos masivos automáticos.</li>
          <li>Intentar dañar el sitio, saltarse sus medidas de seguridad, o extraer datos de forma masiva que afecte su funcionamiento.</li>
        </List>
        <p>Si no se cumplen estas reglas, podemos retirar el contenido y suspender o cancelar la cuenta.</p>
      </Section>

      <Section id="terceros" title="7. Organizadores y servicios de terceros">
        <p>
          Cada evento es responsabilidad de quien lo organiza: la seguridad, la calidad, el precio, los permisos y lo que ocurra en el lugar.
          Los botones de WhatsApp, Google Maps, Waze, redes sociales y sitios de organizadores te llevan a servicios de terceros, que tienen sus
          propios términos. No controlamos esos servicios ni respondemos por ellos.
        </p>
      </Section>

      <Section id="estadisticas" title="8. Estadísticas para organizadores">
        <p>
          A organizadores y comercios les podemos compartir un reporte de cómo le fue a su evento (visitas, interés, de dónde llega la gente).
          Esos reportes son siempre agregados y anónimos, como se explica en el <Link href="/privacidad#finalidades" className="font-medium text-ink underline">Aviso de privacidad</Link>.
          El link del reporte es privado: no lo compartas con quien no deba verlo.
        </p>
      </Section>

      <Section id="propiedad" title="9. Propiedad intelectual">
        <p>
          El nombre entrelugares, el logotipo, el diseño del sitio y la forma en que organizamos la información son nuestros. Los flyers y
          las marcas de cada evento pertenecen a sus dueños. Puedes compartir los links de los eventos libremente; para reutilizar el
          contenido de forma comercial o masiva, pídenos permiso.
        </p>
      </Section>

      <Section id="responsabilidad" title="10. Responsabilidad">
        <p>
          Ofrecemos entrelugares tal como está, sin costo, y hacemos lo posible para que funcione bien y la información sea correcta. En la
          medida que la ley lo permite, no somos responsables por cambios o cancelaciones de eventos, por lo que ocurra en ellos, por
          traslados o gastos que hagas confiando en la agenda, ni por interrupciones temporales del sitio. Nada de esto limita los derechos
          que la ley te reconoce como persona usuaria.
        </p>
      </Section>

      <Section id="cambios" title="11. Cambios y suspensión">
        <p>
          Podemos cambiar estos términos. Publicaremos la nueva versión en esta página con su fecha de actualización y, si el cambio es
          importante, lo avisaremos en el sitio. También podemos modificar o dejar de ofrecer partes del servicio.
        </p>
      </Section>

      <Section id="ley" title="12. Ley aplicable y contacto">
        <p>
          Estos términos se rigen por las leyes de los Estados Unidos Mexicanos. Antes de cualquier reclamación, escríbenos a <Mail subject="Aclaración" />:
          casi todo se resuelve así. Si no llegamos a un acuerdo, la controversia se resolverá ante los tribunales competentes de México,
          sin perjuicio de tu derecho a acudir a la Procuraduría Federal del Consumidor (Profeco).
        </p>
      </Section>
    </LegalPage>
  );
}
