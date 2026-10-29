
document.addEventListener('wheel', function(event) {
    if (event.ctrlKey) {
        event.preventDefault();
    }
}, { passive: false }); // disables zoom  with ctrl + scroll

document.addEventListener('keydown', function(event) {
    if (event.ctrlKey && (
        event.key === '+' ||
        event.key === '-' ||
        event.key === '=' ||
        event.key === '0'
    )) {
        event.preventDefault();
    }
}); // also prevents zoom and stuff but with ctrl +, _, etc etc


signup.addEventListener("click", () => {
   window.location.href = "login.html";
}); // detects when our user hits signup and leads them to the gform

contacts.addEventListener("click", () => {
    document.querySelectorAll(".contact-overlay")
        .forEach(element => element.classList.toggle("show"));
});

blurcontacts.addEventListener("click", () => {
    document.querySelectorAll(".contact-overlay")
        .forEach(element => element.classList.remove("show"));
});

ourtutors.addEventListener("click", () => {
    window.location.href = "tutors.html";
}); // detects when our user hits signup and leads them to the gform

window.addEventListener("scroll", () => {
    let scrollValue = window.scrollY;
    if (isMobile.matches) return;
    if (alreadyloaded === true) {return}
    if (scrollValue >= 300){
        spacingforstats.style.opacity = (scrollValue/ 500);
        stats1.style.opacity = (scrollValue / 500);
        stats2.style.opacity = (scrollValue / 500);
        stats3.style.opacity = (scrollValue / 500);
    }
    if (scrollValue >= 400) {alreadyloaded = true}
}); // tracks how far the user has scrolled. will use this for like animations and stuff
