//client class
class Client {
    constructor(firstName, lastName, email, phone, hrsPerWeek, subject, totalHrs) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.email = email;
        this.phone = phone;
        this.hrsPerWeek = hrsPerWeek;
        this.subject = subject;
        this.totalHrs = totalHrs;
    }
    toJSON() {
    return {
        first_name: this.firstName,
        last_name: this.lastName,
        email: this.email,
        phone: this.phone,
        subject: this.subject,
        hours_per_week: this.hrsPerWeek,
        total_hours: this.totalHrs,
        class_name: "Client"
    };
}
static fromJSON(jsonObject) {
    const from_client = new Client(
        jsonObject.first_name,
        jsonObject.last_name,
        jsonObject.email,
        jsonObject.phone,
        jsonObject.hours_per_week,
        jsonObject.subject,
        jsonObject.total_hours
    );
    return from_client;
}
}




//I'm gonna change the variable names once I figure out how to back up data for users but for now I'll just make it for personal use
var tutorName = "Alan";
var tutorLastName = "Ward";
var tutorEmail = "alanward@example.com";

//temporary client info when necessary, remove once json functioanlity is done
var clientParentPhoneNumber = "123-456-7890";
var seperatedParentNumber = clientParentPhoneNumber.split("-");


//fill out tutor name
document.getElementById("Field11").value = tutorName;
document.getElementById("Field18").value = tutorLastName;

//fill out tutor email
document.getElementById("Field6").value = tutorEmail;

//student info
document.getElementById("Field12").value = "John";
document.getElementById("Field19").value = "Doe";
document.getElementById("Field3").value = "johndoe@example.com";
document.getElementById("Field23").value = seperatedParentNumber[0];
document.getElementById("Field23-1").value = seperatedParentNumber[1];
document.getElementById("Field23-2").value = seperatedParentNumber[2];

//date 
var today = new Date();
document.getElementById("Field9-1").value = today.getMonth() + 1;
document.getElementById("Field9-2").value = today.getDate();
document.getElementById("Field9").value = today.getFullYear();









// ------- json storage stuff get main functioanlity working first -----
//load data from json
function loadData() {
    return JSON.parse(localStorage.getItem())
}

//add client
function addClient(client) {

}
//remove client

//add session

