const buttons = document.querySelectorAll(".sidebar a");
const iconByPage = {
    "home.html": "home",
    "explore.html": "explore",
    "contact-me.html": "subscriptions",
    "my-music.html": "youtube-music",
    "resume.html": "library"
};
const currentPage = location.pathname.split("/").pop() || "home.html"; // defualt

buttons.forEach(link => {
    const linkedPage = link.getAttribute("href");
    const iconName = iconByPage[linkedPage];
    const icon = link.querySelector(".sidebar-icon");

    const state = linkedPage === currentPage ? "filled" : "hollow";

    icon.src = `icons/${iconName}-${state}.svg`;
});
