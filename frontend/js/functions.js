const signup = document.getElementById("signup");
const statsSections = document.querySelectorAll(".stats");
const spacingforstats = document.getElementById("spacing-for-stats");
const stats1 = document.getElementById("stats1");
const stats2 = document.getElementById("stats2");
const stats3 = document.getElementById("stats3");
const isMobile = window.matchMedia("(max-width: 500px)");

let alreadyloaded = false;
const observer = new IntersectionObserver((entries) => {

    entries.forEach((entry) => {

        if (entry.isIntersecting) {

            const section = entry.target;

            const elementsToAnimate = section.querySelectorAll(
                ".hstats, .pstats"
            );

            elementsToAnimate.forEach((element) => {
                element.classList.add("textfadeup");
            });

            observer.unobserve(section);
        }

    });

}, {
    rootMargin: "0px 0px -300px 0px"
});


statsSections.forEach((section) => {
    observer.observe(section);
});

