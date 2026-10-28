function Documents({ setPage }) {

  const documents = [
    {
      name: "Python Documentation.pdf",
      type: "PDF",
      faqs: 24,
      date: "Today"
    },
    {
      name: "TensorFlow Guide.docx",
      type: "DOCX",
      faqs: 31,
      date: "Yesterday"
    },
    {
      name: "Java Technical Guide.txt",
      type: "TXT",
      faqs: 18,
      date: "2 days ago"
    }
  ];


  return (

    <div className="documents-page">

      <div className="page-header">

        <div>

          <span className="eyebrow">
            DOCUMENTS
          </span>

          <h1>
            Your documents
          </h1>

          <p>
            Manage uploaded technical documents
            and generated knowledge.
          </p>

        </div>


        <button
          className="primary-button"
          onClick={() =>
            setPage("dashboard")
          }
        >
          + Upload Document
        </button>

      </div>


      <div className="document-table">

        <div className="table-header">

          <span>
            DOCUMENT
          </span>

          <span>
            TYPE
          </span>

          <span>
            FAQs
          </span>

          <span>
            PROCESSED
          </span>

          <span>
            STATUS
          </span>

        </div>


        {documents.map(
          (document) => (

            <div
              className="document-row"
              key={document.name}
            >

              <div className="document-name">

                <div className="table-file">
                  {document.type}
                </div>

                <strong>
                  {document.name}
                </strong>

              </div>

              <span>
                {document.type}
              </span>

              <strong>
                {document.faqs}
              </strong>

              <span>
                {document.date}
              </span>

              <span className="success-status">
                Completed
              </span>

            </div>

          )
        )}

      </div>

    </div>
  );
}

export default Documents;