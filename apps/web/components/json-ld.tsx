/**
 * Datos estructurados schema.org. Google los usa para resultados enriquecidos (eventos, migas de pan) y los
 * buscadores con IA para citar fecha, lugar y precio sin adivinar. `<` se escapa para que el texto de un
 * flyer no pueda cerrar la etiqueta <script>.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
