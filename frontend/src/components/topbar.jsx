function Topbar({ darkMode, setDarkMode }) {

  return (

    <header className="topbar">

      <div className="breadcrumb">

        <span>
          Workspace
        </span>

        <span>
          /
        </span>

        <strong>
          AI FAQ Generator
        </strong>

      </div>


      <div className="topbar-actions">

        <button className="topbar-icon">
          ?
        </button>

        <button
          className="topbar-icon"
          onClick={() =>
            setDarkMode(!darkMode)
          }
        >
          {darkMode ? "☀" : "☾"}
        </button>

        <div className="profile">

          <div className="profile-avatar">
            V
          </div>

          <div className="profile-info">

            <strong>
              User
            </strong>

            <span>
              Student
            </span>

          </div>

        </div>

      </div>

    </header>
  );
}

export default Topbar;