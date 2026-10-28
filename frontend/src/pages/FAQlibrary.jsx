
import { useEffect, useMemo, useState } from "react";
import FAQCard from "../components/FAQCard";

function FAQLibrary() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [faqs, setFaqs] = useState([]);
  const [documentName, setDocumentName] = useState("");

  useEffect(() => {
    const loadFAQs = () => {
      try {
        const storedFAQs = JSON.parse(
          localStorage.getItem("generatedFAQs") || "[]"
        );

        const storedDocument = JSON.parse(
          localStorage.getItem("generatedDocument") || "null"
        );

        setFaqs(Array.isArray(storedFAQs) ? storedFAQs : []);
        setDocumentName(storedDocument?.filename || "");
      } catch (error) {
        console.error("Failed to read generated FAQs:", error);
        setFaqs([]);
        setDocumentName("");
      }
    };

    loadFAQs();

    // Refresh if the stored data changes in another tab.
    window.addEventListener("storage", loadFAQs);

    return () => {
      window.removeEventListener("storage", loadFAQs);
    };
  }, []);

  const categories = useMemo(() => {
    const uniqueCategories = [
      ...new Set(faqs.map((faq) => faq.category || "General")),
    ];

    return ["All", ...uniqueCategories];
  }, [faqs]);

  const filteredFAQs = useMemo(() => {
    const query = search.toLowerCase().trim();

    return faqs.filter((faq) => {
      const question = faq.question || "";
      const answer = faq.answer || "";

      const matchesSearch =
        `${question} ${answer}`.toLowerCase().includes(query);

      const matchesCategory =
        category === "All" ||
        (faq.category || "General") === category;

      return matchesSearch && matchesCategory;
    });
  }, [faqs, search, category]);

  const exportFAQs = () => {
    if (faqs.length === 0) {
      alert("Generate FAQs from a document before exporting.");
      return;
    }

    const content = faqs
      .map(
        (faq, index) =>
          `${index + 1}. ${faq.question}\nAnswer: ${faq.answer}\nCategory: ${
            faq.category || "General"
          }\n`
      )
      .join("\n");

    const blob = new Blob([content], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "generated-faqs.txt";
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="faq-library">
      <div className="page-header">
        <div>
          <span className="eyebrow">FAQ LIBRARY</span>
          <h1>Generated knowledge</h1>
          <p>
            Search and explore FAQs generated from your documents.
          </p>

          {documentName && (
            <p>
              Source document: <strong>{documentName}</strong>
            </p>
          )}
        </div>

        <button className="primary-button" onClick={exportFAQs}>
          ↓ Export FAQs
        </button>
      </div>

      <div className="faq-toolbar">
        <div className="faq-search">
          <span>⌕</span>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search questions and answers..."
          />
        </div>

        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          aria-label="Filter FAQs by category"
        >
          {categories.map((item) => (
            <option key={item} value={item}>
              {item === "All" ? "All categories" : item}
            </option>
          ))}
        </select>

        <div className="faq-count">
          {filteredFAQs.length} FAQs
        </div>
      </div>

      <div className="faq-library-list">
        {filteredFAQs.length > 0 ? (
          filteredFAQs.map((faq, index) => (
            <FAQCard
              key={faq.id ?? `${faq.question}-${index}`}
              faq={faq}
              number={index + 1}
            />
          ))
        ) : (
          <div className="faq-empty-state">
            <h3>
              {faqs.length === 0
                ? "No generated FAQs yet"
                : "No matching FAQs"}
            </h3>

            <p>
              {faqs.length === 0
                ? "Return to Dashboard, upload a document, and click Generate Intelligent FAQs."
                : "Try a different search term or category."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default FAQLibrary;
