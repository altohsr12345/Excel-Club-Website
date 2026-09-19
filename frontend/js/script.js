
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

window.addEventListener("scroll", () => {
    let scrollValue = window.scrollY;
    if (isMobile.matches) return;
    if (alreadyloaded === true) {return};
    if (scrollValue >= 300){
        spacingforstats.style.opacity = (scrollValue/ 500);
        stats1.style.opacity = (scrollValue / 500);
        stats2.style.opacity = (scrollValue / 500);
        stats3.style.opacity = (scrollValue / 500);
    }
    if (scrollValue >= 400) {alreadyloaded = true}
}); // tracks how far the user has scrolled. will use this for like animations and stuff



signup.addEventListener("click", () => {
    window.open("https://docs.google.com/forms/d/e/1FAIpQLScmfeec8vO8XYncEOtapB7_yHW_vjKFk_hCJ8nWFHiz5hKPBg/viewform");
}); // detects when our user hits signup and leads them to the gform

