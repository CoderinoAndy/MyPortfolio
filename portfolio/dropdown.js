const searchBar = document.querySelector(".search-bar");
const options = document.querySelectorAll(".search-dropdown a");
const noresult = document.querySelector(".noresults")

searchBar.addEventListener("input", ()){
    const text = searchBar.value.toLowerCase();

    Boolean foundoption = false;

    options.forEach((option){
        option.style.display = option.textContent.includes(text) ? "block" : "none";
        if(option.style.display == "block"){
            foundoption = true;
        }
    )}

    if(!foundoption){
        noresult.hidden = false;
    }
    
)}