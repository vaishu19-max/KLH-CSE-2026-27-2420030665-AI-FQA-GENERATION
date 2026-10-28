
import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const API_BASE = "http://localhost:8000";

const processingStages = [
  "Document Upload",
  "Text Extraction",
  "Text Cleaning",
  "Sentence Segmentation",
  "T5 Transformer",
  "FAQ Generation",
  "FAQ Database",
];

function formatFileSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileType(filename = "") {
  const extension = filename.split(".").pop()?.toUpperCase();
  return ["PDF", "DOCX", "TXT"].includes(extension)
    ? extension
    : "FILE";
}

function formatDate(date) {
  if (!date) return "—";
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleDateString();
}

export default function App() {
  // Navigation and interface
  const [page, setPage] = useState("dashboard");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Settings
  const [notifications, setNotifications] = useState(
    () => localStorage.getItem("faq-notifications") !== "false"
  );
  const [autoOpen, setAutoOpen] = useState(
    () => localStorage.getItem("faq-auto-open") !== "false"
  );
  const [appearance, setAppearance] = useState(
    () => localStorage.getItem("faq-appearance") || "dark"
  );

  // Upload and processing
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState(0);

  // Database data
  const [faqs, setFaqs] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("all");
  const [loadingData, setLoadingData] = useState(false);

  // FAQ controls
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [openFAQ, setOpenFAQ] = useState(null);
  const [feedback, setFeedback] = useState({});
  const [copied, setCopied] = useState(null);

  // Notifications and messages
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);
  const faqSearchRef = useRef(null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("faq-notifications", notifications);
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem("faq-auto-open", autoOpen);
  }, [autoOpen]);

  useEffect(() => {
    localStorage.setItem("faq-appearance", appearance);
  }, [appearance]);

  useEffect(() => {
    loadDocuments();
    loadFAQs("all");
    // Initial database loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleKeyboard = (event) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        setPage("faqs");
        setTimeout(() => faqSearchRef.current?.focus(), 100);
      }

      if (event.key === "Escape") {
        setShowProfile(false);
        setShowNotifications(false);
      }
    };

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, []);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  const navigate = (destination) => {
    setPage(destination);
    setMobileMenu(false);
    setShowProfile(false);
    setShowNotifications(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Load saved documents from FastAPI.
  const loadDocuments = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/documents`);

      if (!response.ok) {
        throw new Error("Unable to load documents.");
      }

      const data = await response.json();

      const mapped = data.map((doc) => ({
        id: doc.id,
        filename: doc.filename,
        name: doc.filename,
        type: getFileType(doc.filename),
        size: formatFileSize(doc.file_size),
        date: formatDate(doc.uploaded_at),
        faqs: doc.faq_count || 0,
        status: "Ready",
      }));

      setDocuments(mapped);
      return mapped;
    } catch (error) {
      console.error("Loading documents failed:", error);
      showToast("Could not load documents from the backend.", "error");
      return [];
    }
  };

  // Load FAQs for one selected document or for all documents.
  const loadFAQs = async (documentId = selectedDocumentId) => {
    setLoadingData(true);

    try {
      let loadedFAQs = [];

      if (String(documentId) === "all") {
        const documentsResponse = await fetch(
          `${API_BASE}/api/documents`
        );

        if (!documentsResponse.ok) {
          throw new Error("Could not load documents.");
        }

        const savedDocuments = await documentsResponse.json();

        const groups = await Promise.all(
          savedDocuments.map(async (doc) => {
            const response = await fetch(
              `${API_BASE}/api/documents/${doc.id}/faqs`
            );

            if (!response.ok) return [];

            const result = await response.json();

            return (result.faqs || []).map((faq) => ({
              ...faq,
              source: result.filename || doc.filename,
              documentId: doc.id,
              category: faq.category || "General",
            }));
          })
        );

        loadedFAQs = groups.flat();
      } else {
        const response = await fetch(
          `${API_BASE}/api/documents/${documentId}/faqs`
        );

        if (!response.ok) {
          throw new Error("Could not load FAQs for this document.");
        }

        const result = await response.json();

        loadedFAQs = (result.faqs || []).map((faq) => ({
          ...faq,
          source: result.filename,
          documentId: result.document_id,
          category: faq.category || "General",
        }));
      }

      setFaqs(loadedFAQs);
      setOpenFAQ(null);
    } catch (error) {
      console.error("Loading FAQs failed:", error);
      setFaqs([]);
      showToast("Could not load FAQs from the database.", "error");
    } finally {
      setLoadingData(false);
    }
  };

  // Validate uploaded documents.
  const validateFile = (selectedFile) => {
    if (!selectedFile) return false;

    const extension = selectedFile.name.split(".").pop().toLowerCase();

    if (!["pdf", "docx", "txt"].includes(extension)) {
      showToast("Only PDF, DOCX, and TXT files are supported.", "error");
      return false;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      showToast("Maximum file size is 10 MB.", "error");
      return false;
    }

    return true;
  };

  const selectFile = (selectedFile) => {
    if (!validateFile(selectedFile)) return;
    setFile(selectedFile);
    showToast(`${selectedFile.name} selected.`);
  };

  const handleFileInput = (event) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) selectFile(selectedFile);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);

    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) selectFile(droppedFile);
  };

  const removeFile = () => {
    setFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    showToast("Document removed.");
  };

  const sendGenerationNotification = () => {
    if (
      notifications &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      new Notification("FAQ Generation Complete", {
        body: "Your document was processed and saved successfully.",
      });
    }
  };

  const enableNotifications = async () => {
    if (!("Notification" in window)) {
      showToast("Browser notifications are not supported.", "error");
      return;
    }

    if (Notification.permission === "denied") {
      showToast("Notifications are blocked in browser settings.", "error");
      return;
    }

    if (Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        showToast("Notification permission was not granted.", "error");
        return;
      }
    }

    setNotifications(true);
    showToast("Notifications enabled.");
  };

  const toggleNotifications = async () => {
    if (!notifications) {
      await enableNotifications();
    } else {
      setNotifications(false);
      showToast("Notifications disabled.");
    }
  };

  // Real generation: upload the file to FastAPI and save via SQLite.
  const generateFAQs = async () => {
    if (!file) {
      showToast("Please upload a document first.", "error");
      return;
    }

    if (processing) return;

    setProcessing(true);
    setProgress(5);
    setProcessingStep(0);
    navigate("dashboard");

    let currentProgress = 5;

    const progressTimer = window.setInterval(() => {
      currentProgress = Math.min(currentProgress + 5, 90);
      setProgress(currentProgress);

      setProcessingStep(
        Math.min(
          processingStages.length - 1,
          Math.floor((currentProgress / 100) * processingStages.length)
        )
      );
    }, 600);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_BASE}/api/generate-faqs`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "FAQ generation failed.");
      }

      window.clearInterval(progressTimer);
      setProgress(100);
      setProcessingStep(processingStages.length - 1);

      const updatedDocuments = await loadDocuments();

      // Documents are returned newest first by the backend.
      const savedDocument = updatedDocuments.find(
        (doc) => doc.filename === result.filename
      );

      if (savedDocument) {
        const documentId = String(savedDocument.id);
        setSelectedDocumentId(documentId);
        await loadFAQs(documentId);
      } else {
        setSelectedDocumentId("all");
        await loadFAQs("all");
      }

      showToast(
        `${result.faq_count} FAQs generated and saved successfully.`
      );

      sendGenerationNotification();
      setFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      if (autoOpen) {
        setPage("faqs");
      }
    } catch (error) {
      window.clearInterval(progressTimer);
      console.error("FAQ generation failed:", error);
      showToast(error.message || "FAQ generation failed.", "error");
    } finally {
      setProcessing(false);
    }
  };

  const copyAnswer = async (faq) => {
    const text = `Q: ${faq.question}\n\nA: ${faq.answer}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(faq.id);
      showToast("FAQ copied to clipboard.");

      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      showToast("Unable to copy FAQ.", "error");
    }
  };

  const handleFeedback = (faqId, type) => {
    setFeedback((previous) => ({
      ...previous,
      [faqId]: previous[faqId] === type ? null : type,
    }));

    showToast(
      type === "good"
        ? "Thanks for the positive feedback."
        : "Thanks. We'll use your feedback."
    );
  };

  const categories = useMemo(() => {
    const unique = new Set(faqs.map((faq) => faq.category || "General"));
    return ["All", ...unique];
  }, [faqs]);

  const filteredFAQs = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return faqs.filter((faq) => {
      const matchesSearch =
        !normalizedSearch ||
        (faq.question || "").toLowerCase().includes(normalizedSearch) ||
        (faq.answer || "").toLowerCase().includes(normalizedSearch) ||
        (faq.category || "").toLowerCase().includes(normalizedSearch) ||
        (faq.source || "").toLowerCase().includes(normalizedSearch);

      const matchesCategory =
        category === "All" || (faq.category || "General") === category;

      return matchesSearch && matchesCategory;
    });
  }, [faqs, search, category]);

  const exportFAQs = () => {
    if (!filteredFAQs.length) {
      showToast("There are no FAQs to export.", "error");
      return;
    }

    const content = filteredFAQs
      .map(
        (faq, index) =>
          `${index + 1}. ${faq.question}\n\nAnswer: ${faq.answer}\nCategory: ${faq.category}\nSource: ${faq.source}\n`
      )
      .join("\n----------------------------------------\n\n");

    const blob = new Blob([content], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = "generated-faqs.txt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
    showToast("FAQs exported successfully.");
  };

  const totalFAQs = faqs.length;
  const totalDocuments = documents.length;

  const positiveFeedback = Object.values(feedback).filter(
    (value) => value === "good"
  ).length;

  const negativeFeedback = Object.values(feedback).filter(
    (value) => value === "bad"
  ).length;

  // Reusable sidebar
  const Sidebar = () => (
    <>
      {mobileMenu && (
        <div
          className="mobile-overlay"
          onClick={() => setMobileMenu(false)}
        />
      )}

      <aside className={`sidebar ${mobileMenu ? "open" : ""}`}>
        <button
          className="mobile-close"
          onClick={() => setMobileMenu(false)}
          aria-label="Close menu"
        >
          ×
        </button>

        <div className="brand-block">
          <div className="brand-logo">F</div>
          <div>
            <strong>FAQ Generator</strong>
            <span>DOCUMENT INTELLIGENCE</span>
          </div>
        </div>

        <div className="sidebar-tag">
          <span />
          PRIVATE WORKSPACE
        </div>

        <div className="nav-label">SYSTEM / 01</div>

        <nav className="main-nav">
          {[
            ["dashboard", "01", "Dashboard"],
            ["documents", "02", "Documents"],
            ["faqs", "03", "FAQ Library"],
            ["analytics", "04", "Analytics"],
          ].map(([destination, number, label]) => (
            <button
              key={destination}
              className={page === destination ? "active" : ""}
              onClick={() => navigate(destination)}
            >
              <span>{number}</span>
              {label}
            </button>
          ))}
        </nav>

        <div className="nav-label support-label">SYSTEM / 02</div>

        <nav className="main-nav">
          {[
            ["settings", "05", "Settings"],
            ["help", "06", "Help"],
          ].map(([destination, number, label]) => (
            <button
              key={destination}
              className={page === destination ? "active" : ""}
              onClick={() => navigate(destination)}
            >
              <span>{number}</span>
              {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="mini-system">
            <span className="pulse" />
            T5 ENGINE READY
          </div>

          <div className="sidebar-user">
            <div className="user-avatar">V</div>
            <div>
              <strong>Workspace User</strong>
              <span>Administrator</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );

  const Topbar = () => (
    <header className="topbar">
      <div className="top-location">
        <span>FAQ GENERATOR</span>
        <b>/</b>
        <strong>DOCUMENT INTELLIGENCE</strong>
      </div>

      <div className="top-actions">
        <button
          className="mobile-menu"
          onClick={() => setMobileMenu(true)}
          aria-label="Open menu"
        >
          ☰
        </button>

        <button
          className="command-search"
          onClick={() => {
            navigate("faqs");
            setTimeout(() => faqSearchRef.current?.focus(), 100);
          }}
        >
          SEARCH FAQ <kbd>⌘ K</kbd>
        </button>

        <button
          className="top-icon"
          onClick={() => setShowNotifications((value) => !value)}
          aria-label="Notifications"
        >
          ♧
          {notifications && <i />}
        </button>

        <div className="profile-area">
          <button
            className="top-user"
            onClick={() => setShowProfile((value) => !value)}
          >
            <div className="user-avatar small">V</div>
            USER
          </button>

          {showProfile && (
            <div className="profile-menu">
              <strong>Workspace User</strong>
              <span>Administrator</span>
              <button onClick={() => navigate("settings")}>
                Workspace Settings
              </button>
              <button onClick={() => showToast("You are already signed in.")}>
                Account Status
              </button>
            </div>
          )}
        </div>
      </div>

      {showNotifications && (
        <div className="profile-menu" style={{ right: "150px", top: "68px" }}>
          <strong>Notifications</strong>
          <span>
            {notifications
              ? "Generation alerts are enabled."
              : "Generation alerts are disabled."}
          </span>
          <button onClick={toggleNotifications}>
            {notifications ? "Disable Notifications" : "Enable Notifications"}
          </button>
        </div>
      )}
    </header>
  );

  const UploadPanel = () => (
    <div className="upload-panel">
      <div className="panel-top">
        <div>
          <span>01</span>
          <h3>Upload Document</h3>
        </div>
        <small>MAX 10 MB</small>
      </div>

      {!file ? (
        <label
          className={`upload-zone ${dragging ? "dragging" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={handleFileInput}
          />
          <div className="upload-symbol">↑</div>
          <strong>DROP TECHNICAL DOCUMENT</strong>
          <span>or click to browse your files</span>
          <div className="formats">
            <b>PDF</b>
            <b>DOCX</b>
            <b>TXT</b>
          </div>
        </label>
      ) : (
        <>
          <div className="file-selected">
            <div className="file-big">{getFileType(file.name)}</div>
            <div>
              <strong>{file.name}</strong>
              <span>
                {formatFileSize(file.size)} · Ready for processing
              </span>
            </div>
            <button onClick={removeFile}>REMOVE</button>
          </div>

          <button
            className="generate-button"
            onClick={generateFAQs}
            disabled={processing}
          >
            {processing ? "PROCESSING..." : "GENERATE FAQS"}
            <span>→</span>
          </button>
        </>
      )}

      {processing && (
        <div className="processing-panel">
          <div className="processing-info">
            <div>
              <strong>{processingStages[processingStep] || "Processing"}</strong>
              <span>T5 pipeline is working</span>
            </div>
            <b>{progress}%</b>
          </div>

          <div className="process-bar">
            <span style={{ width: `${progress}%` }} />
          </div>

          <div className="process-steps">
            {processingStages.map((stage, index) => (
              <div key={stage}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{stage}</strong>
                <i>
                  {index < processingStep
                    ? "✓"
                    : index === processingStep
                      ? "●"
                      : "—"}
                </i>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const DocumentTable = ({ items = documents }) => (
    <div className="document-table-wrap">
      <table>
        <thead>
          <tr>
            <th>DOCUMENT</th>
            <th>TYPE</th>
            <th>FAQS</th>
            <th>DATE</th>
            <th>STATUS</th>
          </tr>
        </thead>

        <tbody>
          {items.map((doc) => (
            <tr key={doc.id}>
              <td>
                <div className="document-cell">
                  <span>{doc.type}</span>
                  <div>
                    <strong>{doc.name}</strong>
                    <small>{doc.size}</small>
                  </div>
                </div>
              </td>
              <td>{doc.type}</td>
              <td>{doc.faqs}</td>
              <td>{doc.date}</td>
              <td>
                <span className="table-status">
                  <i />
                  {doc.status}
                </span>
              </td>
            </tr>
          ))}

          {items.length === 0 && (
            <tr>
              <td colSpan="5">
                <div className="empty">
                  <span>□</span>
                  <h3>No documents found</h3>
                  <p>Upload your first technical document.</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const FAQCard = ({ faq, index }) => {
    const isOpen = openFAQ === faq.id;
    const selectedFeedback = feedback[faq.id];

    return (
      <article className="faq-item">
        <button
          className="faq-main"
          onClick={() => setOpenFAQ(isOpen ? null : faq.id)}
        >
          <span>{String(index + 1).padStart(2, "0")}</span>

          <div>
            <h3>{faq.question}</h3>
            <small>
              {faq.category || "General"} · {faq.source || "Uploaded document"}
            </small>
          </div>

          <b>{isOpen ? "−" : "+"}</b>
        </button>

        {isOpen && (
          <div className="faq-expanded">
            <p>{faq.answer}</p>

            <div className="faq-bottom">
              <button onClick={() => copyAnswer(faq)}>
                {copied === faq.id ? "COPIED ✓" : "COPY ANSWER"}
              </button>

              <div>
                <button
                  className={selectedFeedback === "good" ? "selected-good" : ""}
                  onClick={() => handleFeedback(faq.id, "good")}
                >
                  👍 GOOD
                </button>
                <button
                  className={selectedFeedback === "bad" ? "selected-bad" : ""}
                  onClick={() => handleFeedback(faq.id, "bad")}
                >
                  👎 BAD
                </button>
              </div>
            </div>
          </div>
        )}
      </article>
    );
  };

  const Dashboard = () => (
    <section className="inner-page">
      <div className="hero">
        <div className="hero-copy">
          <div className="section-marker">01 / WORKSPACE</div>
          <h1>
            Turn documents
            <br />
            into knowledge.
          </h1>
          <p>
            Generate searchable questions and answers from technical
            documents using the T5 Transformer.
          </p>

          <div className="hero-buttons">
            <label className="orange-button">
              UPLOAD DOCUMENT +
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                style={{ display: "none" }}
                onChange={handleFileInput}
              />
            </label>

            <button className="outline-button" onClick={() => navigate("faqs")}>
              Open FAQ Library
            </button>
          </div>

          <div className="hero-features">
            <span>✓ PDF / DOCX / TXT</span>
            <span>✓ T5 TRANSFORMER</span>
            <span>✓ SEARCHABLE FAQS</span>
          </div>
        </div>

        <div className="orb-area">
          <div className="orb-caption">
            <span>✣</span>
            FROM DOCUMENT
            <br />
            TO KNOWLEDGE
          </div>
          <div className="orbital orbital-three" />
          <div className="orbital orbital-two" />
          <div className="orbital orbital-one" />

          <div className="floating-tag tag-one">
            <span>✓</span>
            LOCAL
            <small>technical documents</small>
          </div>
          <div className="floating-tag tag-two">
            <span>◆</span>
            T5 READY
            <small>transformer pipeline</small>
          </div>
          <div className="floating-tag tag-three">
            <span>↗</span>
            FAQ OUTPUT
            <small>searchable knowledge</small>
          </div>

          <div className="orb-core">
            <div className="core-inner">
              <span className="core-label">AI</span>
              <strong>T5</strong>
              <small>TRANSFORMER</small>
            </div>
          </div>

          <div className="orb-annotation">
            <span>07</span>
            <br />
            PROCESSING
            <br />
            OPERATIONS
          </div>
        </div>
      </div>

      <div className="dashboard-strip">
        <div>
          <span>DOCUMENTS PROCESSED</span>
          <strong>{totalDocuments}</strong>
        </div>
        <div>
          <span>GENERATED FAQS</span>
          <strong>{totalFAQs}</strong>
        </div>
        <div>
          <span>POSITIVE FEEDBACK</span>
          <strong>{positiveFeedback}</strong>
        </div>
        <div>
          <span>SYSTEM STATUS</span>
          <strong>100%</strong>
        </div>
      </div>

      <UploadPanel />

      <div className="section-heading">
        <div>
          <span className="section-marker">02 / RECENT FILES</span>
          <h2>Document Archive.</h2>
        </div>
        <button className="outline-button" onClick={() => navigate("documents")}>
          View All
        </button>
      </div>

      <DocumentTable items={documents.slice(0, 4)} />
    </section>
  );

  const DocumentsPage = () => (
    <section className="inner-page">
      <div className="page-title-new">
        <div>
          <div className="section-marker">02 / DOCUMENTS</div>
          <h1>
            Document
            <br />
            Archive.
          </h1>
          <p>Manage technical documents processed by the FAQ generator.</p>
        </div>

        <label className="orange-button">
          + UPLOAD DOCUMENT
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            style={{ display: "none" }}
            onChange={handleFileInput}
          />
        </label>
      </div>

      <div className="large-stats">
        <div>
          <span>TOTAL DOCUMENTS</span>
          <strong>{totalDocuments}</strong>
        </div>
        <div>
          <span>FAQS GENERATED</span>
          <strong>{documents.reduce((sum, doc) => sum + doc.faqs, 0)}</strong>
        </div>
        <div>
          <span>SUPPORTED FORMATS</span>
          <strong>03</strong>
        </div>
      </div>

      <DocumentTable />
    </section>
  );

  const FAQPage = () => (
    <section className="inner-page">
      <div className="page-title-new">
        <div>
          <div className="section-marker">03 / KNOWLEDGE BASE</div>
          <h1>
            FAQ
            <br />
            Library.
          </h1>
          <p>Search and explore questions generated from your documents.</p>
        </div>

        <button className="orange-button" onClick={exportFAQs}>
          EXPORT FAQS ↓
        </button>
      </div>

      <div className="large-stats">
        <div>
          <span>TOTAL FAQS</span>
          <strong>{totalFAQs}</strong>
        </div>
        <div>
          <span>CATEGORIES</span>
          <strong>{categories.length - 1}</strong>
        </div>
        <div>
          <span>DISPLAYED</span>
          <strong>{filteredFAQs.length}</strong>
        </div>
      </div>

      <div className="faq-controls">
        <select
          aria-label="Filter FAQs by document"
          value={selectedDocumentId}
          onChange={async (event) => {
            const documentId = event.target.value;
            setSelectedDocumentId(documentId);
            await loadFAQs(documentId);
          }}
        >
          <option value="all">All Documents</option>
          {documents.map((doc) => (
            <option key={doc.id} value={String(doc.id)}>
              {doc.filename}
            </option>
          ))}
        </select>

        <div className="big-search">
          <span>⌕</span>
          <input
            ref={faqSearchRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="SEARCH GENERATED FAQS..."
          />
          <kbd>⌘ K</kbd>
        </div>

        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <div className="faq-total">
          <span>RESULTS</span>
          <strong>{filteredFAQs.length}</strong>
        </div>
      </div>

      <div className="faq-list-new">
        {loadingData ? (
          <div className="empty">
            <h3>Loading FAQs...</h3>
            <p>Retrieving saved questions from the database.</p>
          </div>
        ) : filteredFAQs.length > 0 ? (
          filteredFAQs.map((faq, index) => (
            <FAQCard key={`${faq.documentId}-${faq.id}`} faq={faq} index={index} />
          ))
        ) : (
          <div className="empty">
            <span>⌕</span>
            <h3>No matching FAQs</h3>
            <p>
              Try another search, category, or document. Upload a document
              if your database is empty.
            </p>
          </div>
        )}
      </div>
    </section>
  );

  const AnalyticsPage = () => {
    const maxFAQs = Math.max(...documents.map((doc) => doc.faqs), 1);

    return (
      <section className="inner-page">
        <div className="page-title-new">
          <div>
            <div className="section-marker">04 / SYSTEM ANALYTICS</div>
            <h1>
              System
              <br />
              Analytics.
            </h1>
            <p>Monitor documents, generated FAQs, and user feedback.</p>
          </div>
        </div>

        <div className="analytics-stats">
          <div className="metric">
            <span>DOCUMENTS</span>
            <strong>{totalDocuments}</strong>
            <small>ACTIVE ARCHIVE</small>
          </div>
          <div className="metric">
            <span>FAQS</span>
            <strong>{totalFAQs}</strong>
            <small>GENERATED KNOWLEDGE</small>
          </div>
          <div className="metric">
            <span>GOOD FEEDBACK</span>
            <strong>{positiveFeedback}</strong>
            <small>USER SIGNAL</small>
          </div>
          <div className="metric">
            <span>BAD FEEDBACK</span>
            <strong>{negativeFeedback}</strong>
            <small>USER SIGNAL</small>
          </div>
        </div>

        <div className="section-heading">
          <div>
            <span className="section-marker">01 / DOCUMENT ACTIVITY</span>
            <h2>FAQ distribution.</h2>
          </div>
        </div>

        <div className="analytics-bars">
          {documents.map((doc) => (
            <div className="analytics-bar-row" key={doc.id}>
              <span>{doc.filename}</span>
              <div className="analytics-bar">
                <span
                  style={{
                    width: `${(doc.faqs / maxFAQs) * 100}%`,
                  }}
                />
              </div>
              <strong>{doc.faqs}</strong>
            </div>
          ))}
          {documents.length === 0 && <p>No database records yet.</p>}
        </div>
      </section>
    );
  };

  const SettingsPage = () => (
    <section className="inner-page">
      <div className="page-title-new">
        <div>
          <div className="section-marker">05 / PREFERENCES</div>
          <h1>
            Workspace
            <br />
            Settings.
          </h1>
          <p>Manage the appearance and behaviour of the application.</p>
        </div>
      </div>

      <div className="settings-list">
        <div className="setting-row">
          <div>
            <h3>Appearance</h3>
            <p>Choose the workspace theme.</p>
          </div>
          <select
            value={appearance}
            onChange={(event) => setAppearance(event.target.value)}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </div>

        <div className="setting-row">
          <div>
            <h3>Generation Notifications</h3>
            <p>Show a browser notification when generation completes.</p>
          </div>
          <button className="outline-button" onClick={toggleNotifications}>
            {notifications ? "Disable" : "Enable"}
          </button>
        </div>

        <div className="setting-row">
          <div>
            <h3>Open FAQ Library after generation</h3>
            <p>Navigate to your generated FAQs automatically.</p>
          </div>
          <button
            className="outline-button"
            onClick={() => {
              setAutoOpen((value) => !value);
              showToast(`Auto-open ${autoOpen ? "disabled" : "enabled"}.`);
            }}
          >
            {autoOpen ? "Enabled" : "Disabled"}
          </button>
        </div>

        <div className="setting-row">
          <div>
            <h3>Refresh database data</h3>
            <p>Reload documents and FAQs from the backend.</p>
          </div>
          <button
            className="outline-button"
            onClick={async () => {
              await loadDocuments();
              await loadFAQs(selectedDocumentId);
              showToast("Database data refreshed.");
            }}
          >
            Refresh Data
          </button>
        </div>
      </div>
    </section>
  );

  const HelpPage = () => (
    <section className="inner-page">
      <div className="page-title-new">
        <div>
          <div className="section-marker">06 / SUPPORT</div>
          <h1>
            How it
            <br />
            works.
          </h1>
          <p>A simple workflow for turning technical documents into FAQs.</p>
        </div>
      </div>

      <div className="help-new">
        {[
          [
            "01",
            "Upload",
            "Upload a PDF, DOCX, or TXT technical document.",
          ],
          [
            "02",
            "Process",
            "The backend extracts and cleans the document text.",
          ],
          [
            "03",
            "Generate",
            "The T5 Transformer generates question-and-answer pairs.",
          ],
          [
            "04",
            "Explore",
            "Search the saved FAQs and filter them by document.",
          ],
        ].map(([number, title, description]) => (
          <div key={number}>
            <span>{number}</span>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
        ))}
      </div>
    </section>
  );

  const renderPage = () => {
    switch (page) {
      case "documents":
        return <DocumentsPage />;
      case "faqs":
        return <FAQPage />;
      case "analytics":
        return <AnalyticsPage />;
      case "settings":
        return <SettingsPage />;
      case "help":
        return <HelpPage />;
      case "dashboard":
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className={`app theme-${appearance}`}>
      <div className="technical-grid" />
      <div className="ambient ambient-blue" />
      <div className="ambient ambient-orange" />

      <Sidebar />

      <main className="main">
        <Topbar />

        <div className="content">{renderPage()}</div>

        <footer className="site-footer">
          <span>01 / FAQ GENERATOR AI</span>
          <span>TECHNICAL DOCUMENTS · T5 TRANSFORMER · AUTOMATED FAQ</span>
          <span>SYSTEM ONLINE</span>
        </footer>
      </main>

      {toast && (
        <div className={`toast ${toast.type === "error" ? "error" : ""}`}>
          <span>{toast.type === "error" ? "!" : "✓"}</span>
          {toast.message}
        </div>
      )}
    </div>
  );
}
