const user = JSON.parse(localStorage.getItem(`currentUser`))

if (!user) {
    window.location.href = `../aut.html`
} else {
    document.getElementById(`username`).textContent = user.name
    document.getElementById(`mail`).textContent = user.email
}

document.getElementById(`to-home`).addEventListener(`click`, () => {
    window.location.href = `../../index.html`
})
