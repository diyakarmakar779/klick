import Header from "../layout/Header";
import Block from "../ui/Block";

// Screens still being built show an honest empty state instead of a blank page.
export default function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <>
      <Header title={title} />
      <div className="pd-page">
        <div className="k-empty">
          <Block studs={1} unit={14} />
          <h2>{title}</h2>
          <p>{body}</p>
        </div>
      </div>
    </>
  );
}
