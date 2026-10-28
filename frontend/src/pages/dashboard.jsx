
import { useState } from "react";

import StatCard from "../components/StatCard";
import UploadZone from "../components/UploadZone";
import ProcessingPanel from "../components/ProcessingPanel";

const API_URL = "http://localhost:8000/api/generate-faqs";

function Dashboard({ setPage }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [generatedCount, setGeneratedCount] = useState(null);

  const generateFAQs = async () => {
    if (!file) {
      setError("Please upload a document first.");
      return;
    }

    setLoading(true);
    setProgress(15);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      console.log("Uploading document:", file.name);

      // Send the uploaded document to FastAPI.
      const response = await fetch(API_URL, {
        method: "POST",
        body: formData,
      });

      setProgress(65);

      const data = await response.json();

      console.log("Backend response:", data);

      if (!response.ok) {
        throw new Error(
          data.detail || `Backend error: ${response.status}`
        );
      }

      if (!Array.isArray(data.faqs)) {
        throw new Error("The backend did not return an FAQs array.");
      }

      if (data.faqs.length === 0) {
        throw new Error("No FAQs were generated for this document.");
      }

      // Keep the actual backend questions and answers.
      const generatedFAQs = data.faqs.map((faq, index) => ({
        ...faq,
        id: faq.id ?? `faq-${Date.now()}-${index}`,
        question: faq.question,
        answer: faq.answer,
        category: faq.category || "General",
      }));

      // Save the API results using the key read by FAQlibrary.jsx.
      localStorage.setItem(
        "generatedFAQs",
        JSON.stringify(generatedFAQs)
      );

      localStorage.setItem(
        "generatedDocument",
        JSON.stringify({
          filename: data.filename || file.name,
          faqCount: generatedFAQs.length,
          charactersExtracted: data.characters_extracted ?? 0,
          processedAt: new Date().toISOString(),
        })
      );

      // Confirm that the saved questions are the API results.
      const savedFAQs = JSON.parse(
        localStorage.getItem("generatedFAQs") || "[]"
      );

      console.log("FAQs saved:", savedFAQs);
      console.log("Saved FAQ count:", savedFAQs.length);

      if (savedFAQs.length === 0) {
        throw new Error("FAQs could not be saved in the browser.");
      }

      setProgress(100);
      setGeneratedCount(savedFAQs.length);

      await new Promise((resolve) => setTimeout(resolve, 400));

      // Navigate only after saving the FAQs.
      setPage("faqs");
    } catch (err) {
      console.error("FAQ generation failed:", err);

      setError(
        err.message ||
          "Could not connect to the backend. Check that it is running on port 8000."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">DASHBOARD</span>
          <h1>Turn documents into knowledge.</h1>
          <p>
            Upload technical documentation and let AI generate
            contextual FAQs automatically.
          </p>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard
          icon="▣"
          label="DOCUMENTS"
          value="12"
          description="Uploaded documents"
        />

        <StatCard
          icon="?"
          label="GENERATED FAQs"
          value={generatedCount ?? "—"}
          description="From your latest upload"
        />

        <StatCard
          icon="✦"
          label="AI QUALITY"
          value="—"
          description="Evaluation not yet measured"
        />

        <StatCard
          icon="↗"
          label="HELPFUL RATE"
          value="—"
          description="Based on recorded feedback"
        />
      </div>

      <section className="dashboard-section">
        <div className="section-top">
          <div>
            <h2>Create new FAQ knowledge</h2>
            <p>Start by uploading your technical document.</p>
          </div>
        </div>

        {!loading && !file && (
          <UploadZone
            onFileSelect={(selectedFile) => {
              setFile(selectedFile);
              setError("");
            }}
          />
        )}

        {file && !loading && (
          <div className="selected-document">
            <div className="document-icon">
              {file.name.split(".").pop()?.toUpperCase()}
            </div>

            <div>
              <strong>{file.name}</strong>
              <span>{(file.size / 1024).toFixed(1)} KB</span>
            </div>

            <button
              onClick={() => {
                setFile(null);
                setError("");
              }}
            >
              Remove
            </button>
          </div>
        )}

        {loading && <ProcessingPanel progress={progress} />}

        {error && (
          <div
            role="alert"
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 8,
              color: "#b42318",
              background: "#fef3f2",
            }}
          >
            {error}
          </div>
        )}

        {!loading && file && (
          <button
            className="primary-button generate-main"
            onClick={generateFAQs}
          >
            ✦ Generate Intelligent FAQs
          </button>
        )}
      </section>

      <section className="dashboard-section">
        <div className="section-top">
          <div>
            <h2>Recent documents</h2>
            <p>Your recently processed technical documents.</p>
          </div>

          <button
            className="text-button"
            onClick={() => setPage("documents")}
          >
            View all →
          </button>
        </div>

        <div className="recent-list">
          <div className="recent-item">
            <div className="recent-file">PDF</div>
            <div className="recent-info">
              <strong>Python Documentation.pdf</strong>
              <span>Example document</span>
            </div>
            <span className="success-status">Example</span>
          </div>

          <div className="recent-item">
            <div className="recent-file">DOCX</div>
            <div className="recent-info">
              <strong>TensorFlow Guide.docx</strong>
              <span>Example document</span>
            </div>
            <span className="success-status">Example</span>
          </div>

          <div className="recent-item">
            <div className="recent-file">TXT</div>
            <div className="recent-info">
              <strong>Java Technical Guide.txt</strong>
              <span>Example document</span>
            </div>
            <span className="success-status">Example</span>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
