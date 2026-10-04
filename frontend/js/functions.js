const signup = document.getElementById("signup");
const statsSections = document.querySelectorAll(".stats");
const spacingforstats = document.getElementById("spacing-for-stats");
const stats1 = document.getElementById("stats1");
const stats2 = document.getElementById("stats2");
const stats3 = document.getElementById("stats3");
const isMobile = window.matchMedia("(max-width: 500px)");
const contacts = document.getElementById("contacts");
const blurcontacts = document.getElementById("blur-contacts");
const excelreturn = document.getElementById("excelreturn");
const ourtutors = document.getElementById("ourtutors");
const tutorsContainer = document.querySelector("#tutorsContainer");
const card = document.getElementById("tutorcard");
const gradeButtons = document.querySelectorAll(".grade-button");
const tutors = [
    {
        name : "T",
        subjects : ["IGCSE/AS/AL Math 1","AS IT"],
        grade :12,
        description : ""
    },
    {
        name : "P",
        subjects : ["IGCSE Add Math", "IGCSE Coordinated Science","IGCSE/AS Computer Science", "AS Math 1", "AS Physics", "AS Chemistry"],
        grade :11,
        description : ""
    },
    {
        name : "N",
        subjects : ["AS Math 3"],
        grade :12,
        description : ""
    },
    {
        name : "K",
        subjects : ["IGCSE Computer Science", "IGCSE Math Extended", "IGCSE Coordinated Science", "IGCSE Combined Science", "AS Computer Science"],
        grade :11,
        description : ""
    },
    {
        name : "M",
        subjects : ["AS/AL Math","IGCSE/AS CS"],
        grade :12,
        description : ""
    },
    {
        name : "A",
        subjects : ["IGCSE/AS Math", "IGCSE/AS/AL Economics", "IGCSE ICT"],
        grade :12,
        description : ""
    },
    {
        name : "M",
        subjects : ["AS/AL Math 2", "AS/AL Math 3", "IGCSE Math Extended"],
        grade :12,
        description : ""
    },
    {
        name : "B",
        subjects : ["AS/AL Math 1", "AS Chemistry", "AS Physics"],
        grade :12,
        description : ""
    },
    {
        name : "S",
        subjects : ["IGCSE/AS/A Math","AS/A Physics","IGCSE/AS Computer Science"],
        grade :12,
        description : ""
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
//lalalala i will refactor this laterihvoiwevubewo9uh
function displayTutors(grade) {
    tutorsContainer.innerHTML = "";

    const filteredTutors = tutors.filter(tutor => tutor.grade === grade);

    filteredTutors.forEach(tutor => {
        const card = document.createElement("div");

        card.classList.add("tutorcard");

        card.innerHTML = `
            <h3 class="tutorname">${tutor.name}</h3> 
            <p class="tutordetails">${tutor.subjects.join(", ")}</p> <br>
            <p class="tutordetails">Grade ${tutor.grade}</p> <br>
            <p class="tutordetails">${tutor.description}</p>
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

