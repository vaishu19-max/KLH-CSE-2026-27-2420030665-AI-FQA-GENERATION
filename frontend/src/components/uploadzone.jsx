import { useState } from "react";

function UploadZone({ onFileSelect }) {

  const [dragging, setDragging] =
    useState(false);

  const handleFile = (file) => {

    if (!file) return;

    const allowed = [
      ".pdf",
      ".docx",
      ".txt"
    ];

    const extension =
      file.name
        .substring(
          file.name.lastIndexOf(".")
        )
        .toLowerCase();

    if (!allowed.includes(extension)) {

      alert(
        "Only PDF, DOCX and TXT files are supported."
      );

      return;
    }

    onFileSelect(file);
  };


  return (

    <label
      className={
        dragging
          ? "upload-zone dragging"
          : "upload-zone"
      }

      onDragOver={(e) => {

        e.preventDefault();

        setDragging(true);

      }}

      onDragLeave={() =>
        setDragging(false)
      }

      onDrop={(e) => {

        e.preventDefault();

        setDragging(false);

        handleFile(
          e.dataTransfer.files[0]
        );

      }}
    >

      <input
        type="file"
        accept=".pdf,.docx,.txt"
        onChange={(e) =>
          handleFile(e.target.files[0])
        }
      />


      <div className="upload-cloud">
        ↑
      </div>


      <h3>
        Drop your document here
      </h3>


      <p>
        or <strong>browse from your computer</strong>
      </p>


      <div className="upload-formats">

        <span>PDF</span>
        <span>DOCX</span>
        <span>TXT</span>

      </div>


      <small>
        Technical documents up to 20 MB
      </small>

    </label>
  );
}

export default UploadZone;