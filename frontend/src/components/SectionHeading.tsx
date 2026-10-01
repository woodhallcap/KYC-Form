interface SectionHeadingProps {
  /** "Section A: Entity Information" renders the marker in copper; text without a marker stays plain. */
  text: string;
}

export function SectionHeading({ text }: SectionHeadingProps) {
  const split = text.indexOf(': ');
  if (split === -1) return <h2>{text}</h2>;
  return (
    <h2>
      <span className="text-copper">{text.slice(0, split + 1)}</span> {text.slice(split + 2)}
    </h2>
  );
}
