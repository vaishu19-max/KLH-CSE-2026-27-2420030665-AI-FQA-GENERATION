import { useState } from "react";

function FAQCard({ faq, number }) {

  const [feedback, setFeedback] =
    useState(null);

  const [copied, setCopied] =
    useState(false);


  const copyFAQ = async () => {

    await navigator.clipboard.writeText(
      `${faq.question}\n\n${faq.answer}`
    );

    setCopied(true);

    setTimeout(
      () => setCopied(false),
      1500
    );
  };


  const giveFeedback = (type) => {

    setFeedback(
      feedback === type
        ? null
        : type
    );
  };


  return (

    <article className="faq-card">

      <div className="faq-question">

        <div className="faq-number">
          Q{String(number).padStart(2, "0")}
        </div>

        <div className="faq-main">

          <div className="faq-meta">

            <span>
              {faq.category}
            </span>

            <small>
              AI Confidence {faq.confidence}%
            </small>

          </div>

          <h3>
            {faq.question}
          </h3>

        </div>

      </div>


      <div className="faq-answer">

        <span>
          ANSWER
        </span>

        <p>
          {faq.answer}
        </p>

      </div>


      <div className="faq-actions">

        <span>
          Generated from document context
        </span>


        <div className="action-buttons">

          <button
            onClick={copyFAQ}
            className="copy-button"
          >
            {copied
              ? "✓ Copied"
              : "Copy"}
          </button>


          <button
            className={
              feedback === "good"
                ? "feedback good"
                : "feedback"
            }

            onClick={() =>
              giveFeedback("good")
            }
          >
            👍
          </button>


          <button
            className={
              feedback === "bad"
                ? "feedback bad"
                : "feedback"
            }

            onClick={() =>
              giveFeedback("bad")
            }
          >
            👎
          </button>

        </div>

      </div>


      {feedback === "good" && (

        <div className="feedback-message good-feedback">

          ✓ Thanks! This FAQ was helpful.

        </div>

      )}


      {feedback === "bad" && (

        <div className="feedback-message bad-feedback">

          Thanks for the feedback. This helps
          improve FAQ quality.

        </div>

      )}

    </article>
  );
}

export default FAQCard;