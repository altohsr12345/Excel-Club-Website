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
        name : "Tiana",
        subjects : ["IGCSE/AS/AL Math 1","AS IT"],
        grade :12,
        description : ""
    },
    {
        name : "Tubi",
        subjects : ["IGCSE/AS Math", "IGCSE Coordinated Science","IGCSE/AS Computer Science","AS Physics", "AS Chemistry"],
        grade :11,
        description : ""
    },
    {
        name : "Cista",
        subjects : ["AS Math 3"],
        grade :12,
        description : ""
    },
    {
        name : "Kaito",
        subjects : ["IGCSE Computer Science", "IGCSE Math Extended", "IGCSE Coordinated Science", "IGCSE Combined Science", "AS Computer Science"],
        grade :11,
        description : ""
    },
    {
        name : "Matthew",
        subjects : ["AS/AL Math","IGCSE/AS CS"],
        grade :12,
        description : ""
    },
    {
        name : "Alycia",
        subjects : ["IGCSE/AS Math", "IGCSE/AS/AL Economics", "IGCSE ICT"],
        grade :12,
        description : ""
    },
    {
        name : "Indira",
        subjects : ["AS/AL Math 2", "AS/AL Math 3", "IGCSE Math Extended"],
        grade :12,
        description : ""
    },
    {
        name : "Justin",
        subjects : ["AS/AL Math 1", "AS Chemistry", "AS Physics"],
        grade :12,
        description : ""
    },
    {
        name : "Hiro",
        subjects : ["IGCSE/AS/A Math","AS/A Physics","IGCSE/AS Computer Science"],
        grade :12,
        description : ""
    },
    {
        name : "Kalila",
        subjects : ["IGCSE First Language English", "IGCSE Coordinated Science"],
        grade :12,
        description : ""
    },
    {
        name : "Mayra",
        subjects : ["AL Math 2/3","AS Math 1/2/3","AS/AL Biology"],
        grade :12,
        description : ""
    },
    {
        name : "Aurelia",
        subjects : ["AS/AL Biology"],
        grade :12,
        description : ""
    },
    {
        name : "Daphnee",
        subjects : ["AS/AL Media Studies"],
        grade :12,
        description : ""
    },
    {
        name : "Kevin",
        subjects : ["IGCSE/AS Economics"],
        grade :12,
        description : ""
    },
    {
        name : "Iris",
        subjects : ["IGCSE ICT","IGCSE Sociology","IGCSE FLE", "English G7-8", "IGCSE Coordinated Sciences"],
        grade :11,
        description : ""
    },
    {
        name : "Landia",
        subjects : ["IGCSE Additional/Extended Math","IGCSE Coordinated Sciences", "IGCSE Economics"],
        grade :11,
        description : ""
    },
    {
        name : "Cherys",
        subjects : ["IGCSE Sociology","IGCSE Coordinated Science","IGCSE Business"],
        grade :11,
        description : ""
    },
    {
        name : "Olivija",
        subjects : ["AS Math 2","IGCSE Accounting","IGCSE Economics"],
        grade :11,
        description : ""
    },
    {
        name : "Ello",
        subjects : ["IGCSE Accounting","IGCSE Economics","IGCSE Business"],
        grade :11,
        description : ""
    },
    {
        name : "Hugo",
        subjects : ["IGCSE Additional/Extended Math"],
        grade :11,
        description : ""
    },
    {
        name : "Danica",
        subjects : ["IGCSE Math","AS Math 2", "IGCSE Economics"],
        grade :11,
        description : ""
    },
    {
        name : "Alana",
        subjects : ["AS Math 2","IGCSE Additional/Extended Math"],
        grade :11,
        description : ""
    },
    {
        name : "Nadine",
        subjects : ["IGCSE Additional Math","IGCSE Computer Science","IGCSE Coordinated Science"],
        grade :11,
        description : ""
    },
    {
        name : "Aila",
        subjects : ["IGCSE Extended/Additional Math", "IGCSE Coordinated Science","IGCSE Business"],
        grade :10,
        description : ""
    },
    {
        name : "Abby",
        subjects : ["IGCSE Additional/Extended Math","IGCSE Business","IGCSE Economics"],
        grade :10,
        description : ""
    },
    {
        name : "Joshua",
        subjects : ["IGCSE Additional/Extended Math","IGCSE Computer Science","IGCSE Coordinated Science"],
        grade :10,
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

