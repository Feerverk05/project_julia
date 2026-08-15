(function () {
    const toggle = document.getElementById("menu-toggle");
    const nav = document.getElementById("main-nav");
    const overlay = document.getElementById("nav-overlay");

    if (!toggle || !nav) return;

    function setOpen(open) {
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        toggle.setAttribute(
            "aria-label",
            open ? "Закрити меню" : "Відкрити меню"
        );

        nav.classList.toggle("open", open);

        if (overlay) {
            overlay.classList.toggle("visible", open);
            overlay.setAttribute("aria-hidden", open ? "false" : "true");
        }

        document.body.classList.toggle("menu-open", open);
    }

    toggle.addEventListener("click", function (e) {
        e.stopPropagation();

        const isOpen = toggle.getAttribute("aria-expanded") === "true";
        setOpen(!isOpen);
    });

    if (overlay) {
        overlay.addEventListener("click", function () {
            setOpen(false);
        });
    }

    nav.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", function () {
            setOpen(false);
        });
    });


    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
            setOpen(false);
        }
    });

    window.addEventListener("resize", function () {
        if (window.innerWidth > 992) {
            setOpen(false);
        }
    });
})();