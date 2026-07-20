const searchBar = document.querySelector(".search-bar");
const options = document.querySelectorAll(".search-dropdown a:not(#noresults)");
const noresult = document.querySelector("#noresults");

noresult.hidden = true;

searchBar.addEventListener("input", () => {
    const text = searchBar.value.toLowerCase();

    let foundoption = false;

    options.forEach((option) => {
        option.style.display = option.textContent.toLowerCase().includes(text) ? "block" : "none";
        if(option.style.display === "block"){
            foundoption = true;
        }
    });

    if(!foundoption){
        noresult.hidden = false;
    } else {
        noresult.hidden = true;
    }
    
});