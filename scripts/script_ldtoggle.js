const toggleBtn = document.getElementById("toggleMode");
const body = document.body;
const logo = document.getElementById("icon");

// Load saved mode from localStorage
if (localStorage.getItem("theme") === "dark") {
    body.classList.add("dark");
}

toggleBtn.addEventListener("click", () => {
    body.classList.toggle("dark");
    logo.src = body.classList.contains("dark") ? "../assets/ddcda_light.png" : "../assets/ddcda_dark.png";

    // Save preference
    if (body.classList.contains("dark")) {
        localStorage.setItem("theme", "dark");
    } else {
        localStorage.setItem("theme", "light");
    }
});