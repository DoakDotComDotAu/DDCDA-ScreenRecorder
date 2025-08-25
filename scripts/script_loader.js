var myVar;

function myFunction() {
  showPageTimeout = Math.floor(Math.random() * 3000) + 1000;
  myVar = setTimeout(showPage, showPageTimeout);
}

function showPage() {
  document.getElementById("loader").style.display = "none";
  document.getElementById("wrap").style.display = "block";
}