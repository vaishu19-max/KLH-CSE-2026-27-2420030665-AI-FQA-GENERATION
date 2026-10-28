function Settings() {

  return (

    <div className="settings-page">

      <div className="page-header">

        <div>

          <span className="eyebrow">
            SETTINGS
          </span>

          <h1>
            Application settings
          </h1>

          <p>
            Configure your FAQ generation experience.
          </p>

        </div>

      </div>


      <div className="settings-card">

        <div className="setting-row">

          <div>

            <strong>
              AI Model
            </strong>

            <span>
              Transformer used for FAQ generation
            </span>

          </div>

          <select>

            <option>
              T5 Transformer
            </option>

          </select>

        </div>


        <div className="setting-row">

          <div>

            <strong>
              Supported formats
            </strong>

            <span>
              Accepted technical document formats
            </span>

          </div>

          <div className="setting-tags">

            <span>PDF</span>
            <span>DOCX</span>
            <span>TXT</span>

          </div>

        </div>


        <div className="setting-row">

          <div>

            <strong>
              FAQ generation
            </strong>

            <span>
              Automatically generate contextual question-answer pairs
            </span>

          </div>

          <div className="toggle active">
            <span></span>
          </div>

        </div>

      </div>

    </div>
  );
}

export default Settings;