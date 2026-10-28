function ProcessingPanel({ progress }) {

  const steps = [
    "Document uploaded",
    "Text extraction",
    "Text cleaning",
    "Sentence segmentation",
    "Text chunking",
    "T5 Transformer",
    "FAQ generation"
  ];

  return (

    <div className="processing-panel">

      <div className="processing-header">

        <div>

          <span className="ai-label">
            AI PROCESSING
          </span>

          <h3>
            Generating intelligent FAQs
          </h3>

        </div>

        <strong>
          {progress}%
        </strong>

      </div>


      <div className="progress-track">

        <div
          style={{
            width: `${progress}%`
          }}
        />

      </div>


      <div className="processing-steps">

        {steps.map(
          (step, index) => {

            const stepProgress =
              ((index + 1) /
                steps.length) *
              100;

            const completed =
              progress >=
              stepProgress;

            return (

              <div
                key={step}
                className={
                  completed
                    ? "processing-step completed"
                    : "processing-step"
                }
              >

                <span>

                  {completed
                    ? "✓"
                    : index + 1}

                </span>

                {step}

              </div>

            );
          }
        )}

      </div>

    </div>
  );
}

export default ProcessingPanel;