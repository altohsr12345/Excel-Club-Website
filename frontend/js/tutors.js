
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
    window.open("https://docs.google.com/forms/d/e/1FAIpQLScmfeec8vO8XYncEOtapB7_yHW_vjKFk_hCJ8nWFHiz5hKPBg/viewform");
}); // detects when our user hits signup and leads them to the gform

contacts.addEventListener("click", () => {
    document.querySelectorAll(".contact-overlay")
        .forEach(element => element.classList.toggle("show"));
});

blurcontacts.addEventListener("click", () => {
    document.querySelectorAll(".contact-overlay")
        .forEach(element => element.classList.remove("show"));
});

excelreturn.addEventListener("click", () => {
    window.location.href = "index.html";
});



tutors.forEach(tutor => {
    const card = document.createElement("div");

    card.classList.add("tutorcard");

    card.innerHTML = `
        <h3 class="tutorname">${tutor.name}</h3>
        <p class="tutordetails">${tutor.subjects.join("<br>")}</p> <br>
        <p class="tutordetails">Grade ${tutor.grade}</p> <br>
        <p class="tutordetails">${tutor.description}</p>
    `;

    tutorsContainer.appendChild(card);
}); //just displays all tutor cards initally\


gradeButtons.forEach(button => {
    button.addEventListener("click", () => {
        const grade = Number(button.dataset.grade);

        displayTutors(grade);
    });
}); //calls function to display the tutor card for a selected grade











window.addEventListener("scroll", () => {
}); // tracks how far the user has scrolled. will use this for like animations and stuff
