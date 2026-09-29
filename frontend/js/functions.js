const signup = document.getElementById("signup");
const statsSections = document.querySelectorAll(".stats");
const spacingforstats = document.getElementById("spacing-for-stats");
const stats1 = document.getElementById("stats1");
const stats2 = document.getElementById("stats2");
const stats3 = document.getElementById("stats3");
const isMobile = window.matchMedia("(max-width: 500px)");
const contacts = document.getElementById("contacts");
const blurcontacts = document.getElementById("blur-contacts");
const ourtutors = document.getElementById("ourtutors");
const tutorsContainer = document.querySelector("#tutorsContainer");
const card = document.getElementById("tutorcard");
const gradeButtons = document.querySelectorAll(".grade-button");
const tutors = [
    {
        name : "test",
        subjects : ["test", "test"],
        grade : 10,
        description : "lalalalal"
    },
    {
        name : "test3",
        subjects : ["test3", "tes3t"],
        grade : 12,
        description : "lala2lalal"
    },
    {
        name : "tesst",
        subjects : ["tedst", "tqest"],
        grade : 11,
        description : "lalaasdlfalal"
    },
    {
        name : ";kmlkm",
        subjects : ["CS", "MAth"],
        grade : 11,
        description : "6767"
    },
];
// READ ME //
// helo to whoever is reading this, if u wanna add more tutors, copy paste the stuff into the code above
//    {
//         name : "insertname",
//         subjects : ["insertsubject", "insertsubject"],
//         grade : number,
//         description : "insertdescription"
//     },

// do NOT forget the swiggly brackets and the commas. also u can add more subjects if u want like ["CS", "Math", "Science", "English"]
// ... etc. just add more commas and stuff.
function displayTutors(grade) {
    tutorsContainer.innerHTML = "";

    const filteredTutors = tutors.filter(tutor => tutor.grade === grade);

    filteredTutors.forEach(tutor => {
        const card = document.createElement("div");

        card.classList.add("tutorcard");

        card.innerHTML = `
            <h3>${tutor.name}</h3>
            <p>${tutor.subjects.join(", ")}</p>
            <p>Grade ${tutor.grade}</p>
            <p>${tutor.description}</p>
        `;

        tutorsContainer.appendChild(card);
    });
}



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

