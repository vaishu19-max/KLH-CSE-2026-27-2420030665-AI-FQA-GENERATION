function Sidebar({ page, setPage }) {

  const menu = [
    {
      id: "dashboard",
      icon: "⌂",
      label: "Dashboard"
    },
    {
      id: "documents",
      icon: "▣",
      label: "Documents"
    },
    {
      id: "faqs",
      icon: "☷",
      label: "FAQ Library"
    }
  ];

  return (

    <aside className="sidebar">

      {/* LOGO */}

      <div className="sidebar-logo">

        <div className="logo-mark">
          ✦
        </div>

        <div>

          <strong>
            FAQ.AI
          </strong>

          <span>
            Document Intelligence
          </span>

        </div>

      </div>


      {/* WORKSPACE */}

      <div className="menu-section">

        <span className="menu-label">
          WORKSPACE
        </span>

        {menu.map((item) => (

          <button
            key={item.id}

            className={
              page === item.id
                ? "menu-item active"
                : "menu-item"
            }

            onClick={() =>
              setPage(item.id)
            }
          >

            <span className="menu-icon">
              {item.icon}
            </span>

            {item.label}

          </button>

        ))}

      </div>


      {/* SYSTEM */}

      <div className="menu-section system-menu">

        <span className="menu-label">
          SYSTEM
        </span>

        <button
          className={
            page === "settings"
              ? "menu-item active"
              : "menu-item"
          }

          onClick={() =>
            setPage("settings")
          }
        >

          <span className="menu-icon">
            ⚙
          </span>

          Settings

        </button>

        <button className="menu-item">

          <span className="menu-icon">
            ?
          </span>

          Help & Support

        </button>

      </div>


      {/* BOTTOM STATUS */}

      <div className="sidebar-bottom">

        <div className="ai-status">

          <span className="online-dot"></span>

          <div>

            <strong>
              AI System
            </strong>

            <small>
              Online
            </small>

          </div>

        </div>

        <span className="version">
          v1.0
        </span>

      </div>

    </aside>
  );
}

export default Sidebar;