// init map at Akyaka
var map = L.map('map', {zoomControl: false}).setView([37.05644, 28.32697], 13);

var icons = {
    "default": L.icon({
        iconUrl: 'images/default_marker.png',
        iconSize: [28, 37],
        iconAnchor: [16, 35],
        popupAnchor: [-3, -76],
    }),
    "yangin": L.icon({
        iconUrl: 'images/yangin_marker.png',
        iconSize: [34, 47],
        iconAnchor: [21, 45],
        popupAnchor: [-3, -76],
    }),
    "risk": L.icon({
        iconUrl: 'images/risk_marker.png',
        iconSize: [34, 47],
        iconAnchor: [21, 45],
        popupAnchor: [-3, -76],
    }),
    "kaynak": L.icon({
        iconUrl: 'images/kaynak_marker.png',
        iconSize: [34, 47],
        iconAnchor: [22, 44],
        popupAnchor: [-3, -76],
    }),
    "eylem": L.icon({
        iconUrl: 'images/eylem_marker.png',
        iconSize: [34, 47],
        iconAnchor: [22, 44],
        popupAnchor: [-3, -76],
    })
}

L.tileLayer('https://{s}.tile.osm.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

let pod_url = "https://harita.akyakaafetgonulluleri.org/pod";
let owner_key = ""; // "2328973316878751494510816898038471610233361909884310540443953919";
let db_key = ""; // "8989386497368142848786503809880233031532548080223791396262909908";
let logged_in = false;
let filters = {
    category: [],
    reportType: [],
    subtype: [],
}
window.client = new Memri.default(owner_key, db_key, null, pod_url)

async function sha256(message) {
    const msgUint8 = new TextEncoder().encode(message);                           // encode as (utf-8) Uint8Array
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);           // hash the message
    const hashArray = Array.from(new Uint8Array(hashBuffer));                     // convert buffer to byte array
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); // convert bytes to hex string
    return hashHex;
  }

async function getPBKDF2(salt, password, iterations, keyLength) {
    const textEncoder = new TextEncoder("utf-8");
    const passwordBuffer = textEncoder.encode(password);
    const importedKey = await crypto.subtle.importKey("raw", passwordBuffer, "PBKDF2", false, ["deriveBits"]);
    
    const saltBuffer = textEncoder.encode(salt);
    const params = {name: "PBKDF2", hash: "SHA-256", salt: saltBuffer, iterations: iterations};
    const derivation = await crypto.subtle.deriveBits(params, importedKey, keyLength*8);
    const hashArray = Array.from(new Uint8Array(derivation));                     // convert buffer to byte array
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); // convert bytes to hex string
    return hashHex;
}

function info() {
    return null;
}

async function importCSV() {
    return null;
}

async function exportCSV() {
    let report_data = [['Kategori', 'Alt Kategori', 'Onem', 'Mesaj', 'Raporlayan', 'Raporlayan telefon', 'Durum', 'Enlem', 'Boylam', 'Kayit tarihi']];
    let query = "query { Report { category subtype reporter { username fullName hasPhoneNumber { phoneNumber } } importance text status location { latitude longitude } } }";
    reports = await client.search_graphql(query);
    reports.forEach(r => {
        let row = [];
        row.push(r.category);
        row.push(r.subtype);
        row.push(r.importance);
        row.push('"' + r.text + '"');
        // full name
        if (r.reporter && r.reporter.length > 0)
            row.push(r.reporter[0].fullName? r.reporter[0].fullName : r.reporter[0].username);
        else
            row.push("");
        // phone number
        if (r.reporter && r.reporter[0].hasPhoneNumber.length > 0)
            row.push(r.reporter[0].hasPhoneNumber[0].phoneNumber? r.reporter[0].hasPhoneNumber[0].phoneNumber : "");
        else
            row.push("");
        // status
        row.push(r.status);
        // location
        if (r.location && r.location.length > 0)
            row.push(r.location[0].latitude, r.location[0].longitude);
        else
            row.push("","");
        // date
        row.push(new Date(r.dateCreated).toLocaleString('tr-TR'));
        report_data.push(row)
    });
    csvGenerator = new CsvGenerator(report_data, 'reports-' + new Date().toLocaleString('tr-TR') + '.csv');
    csvGenerator.download();
    
    let reporter_data = [['Telegram adi', 'Tam adi', 'Bilgi', 'Telefon Numarasi', 'Kayit tarihi']];
    query = "query { Reporter { username fullName information hasPhoneNumber { phoneNumber } } }";
    reporters = await client.search_graphql(query);
    reporters.forEach(r => {
        let row = [];
        row.push(r.username);
        row.push(r.fullName);
        row.push('"' + r.information + '"');
        row.push(r.hasPhoneNumber? r.hasPhoneNumber[0].phoneNumber : "");
        row.push(new Date(r.dateCreated).toLocaleString('tr-TR'));
        reporter_data.push(row)
    });
    csvGenerator = new CsvGenerator(reporter_data, 'reporters-' + new Date().toLocaleString('tr-TR') + '.csv');
    csvGenerator.download();
}

function copy(text) {
    navigator.clipboard.writeText(text).then(r => console.log("Copied to clipboard"))
}

function toggleFilter(element) {
    let category = element.className.split(" ")[0];
    if (filters.category.includes(category)) {
        filters.category.splice(filters.category.indexOf(category), 1);
        element.className = element.className.replace(" selected", "");
    } else {
        filters.category.push(element.className);
        element.className = element.className  + " selected";
    }
    show_reports()
}

function createDateHTML(d) {
    let current_date = new Date();
    let time_diff = current_date - d;
    if (time_diff < 1000 * 60)
        return `<div class='datetime'><div class='date'>${Math.round(time_diff/1000)} saniye önce</div></div>`;
    else if (time_diff < 1000 * 60 * 60)
        return `<div class='datetime'><div class='date'>${Math.round(time_diff/(60*1000))} dakika önce</div></div>`;
    else if (time_diff < 1000 * 60 * 60 * 24)
        return `<div class='datetime'><div class='date'>${Math.round(time_diff/(60*60*1000))} saat önce</div></div>`;
    else 
        return`<div class='datetime'><div class='date'>${d.toLocaleDateString('tr')}</div><div class='time'>${d.toLocaleTimeString('tr')}</div></div>`;
}

async function build_popup_text(r) {
    let lines = [];
    let header = "";
    let phone_number = "";
    let full_name = "";

    if (r.reporter && r.reporter.length > 0) {
        full_name = r.reporter[0].fullName? r.reporter[0].fullName : r.reporter[0].username;
        phone_number = r.reporter[0].hasPhoneNumber? r.reporter[0].hasPhoneNumber[0].phoneNumber : "";
    }
        
    header = "<div class='popup-header'><span>" + full_name + "</span><span class='phone'>" + phone_number + "</span></div>";
    
    let content_html = "<div class='popup-content'>";
    if (r.photo && r.photo.length > 0) {
        content_html += "<div class='photo-wrapper'>";
        let sha256 = r.photo[0].file[0].sha256;
        blob = await client.get_file(sha256)
        if (blob) {
            image_src = URL.createObjectURL(blob);
            content_html += "<img onclick='displayImage(this)' src='" + image_src + "'/>";
        }
        content_html += "</div>";
    }

    content_html += "<div class='text-wrapper'>";
    if (r.location && r.location.length > 0) {
        let maps_url = `https://www.google.com/maps/search/?api=1&query=${r.location[0].latitude},${r.location[0].longitude}`;
        content_html += `<div class='location_link'><a style='vertical-align:top;cursor:pointer;' href='${maps_url}' target='_blank'>Konum</a><span><img style='cursor:pointer;' width='18' onclick='copy("${maps_url}")' src='images/copy.png'></span></div>`;
    }
    let d = new Date(r.dateCreated);
    content_html += createDateHTML(d);
    if (r.category) lines.push(r.category);
    if (r.subtype) lines.push(r.subtype);
    if (r.text) lines.push(r.text);
    content_html += lines.join("<br/>");
    content_html += "</div></div>";

    r.popupHTML = header + content_html;
    return r;
}

async function test_connection() {
    reporters = await client.search({type: "Reporter"});
    if (!reporters || reporters.length == 0) {
        return false
    }
    return true;
}

function fixCategoryIcon(s) {
    switch (s) {
        case "Yangın":
        case "Yangin":
            return "yangin";
        case "Risk":
            return "risk";
        case "Su kaynağı":
        case "Tanker":
            return "kaynak";
        case "Anlık Konum Bildir":
        case "Buluşma":
        case "Trafiği Açık Tutma Noktası":
        case "Trafigi acmak":
        case "Yonlendirme tabelasi":
        case "\"Yangina Gider\" Tabelası":
            return "eylem"
        default:
            return "default";
    }
}

let active_layer = null;
let markers = {}
function show_reports() {
    let search_obj = {
        type :'Report'
    }
    if (filters.category.length == 1) search_obj.category = filters.category[0];
    // if (filters.reportType) search_obj.reportType = filters.reportType;
    // if (filters.subtype) search_obj.subtype = filters.subtype;
    let query = "query { Report { category subtype reporter { username fullName hasPhoneNumber { phoneNumber } } importance text status location { latitude longitude } photo { file { sha256 } } } }";
    client.search_graphql(query).then(res => {
        // clear existing markers
        if (active_layer) active_layer.clearLayers();
        // recreate the layer
        active_layer = L.layerGroup().addTo(map);
        res.forEach(report => {
            let category_icon = fixCategoryIcon(report.category)
            // hide deleted
            if (report.deleted == true) return;
            // apply filters
            if (filters.category.length > 0 && !filters.category.includes(category_icon)) return;
            // hide old volunteer locations
            if (category_icon == "konum" && report.dateModified < Date.now() - 1000 * 60 * 60 * 24) {
                return;
            }

            report.icon = icons[category_icon];
            
            build_popup_text(report).then(r => {
                for (l of r.location) {
                    let marker = L.marker([l.latitude, l.longitude], {icon: r.icon, riseOnHover: true}).addTo(map).bindPopup(r.popupHTML);
                    marker.on('click', function() {
                        this.hover_action = false;
                        this.openPopup();
                    });
                    marker.on('mouseover', function (e) {
                        if (!this.getPopup().isOpen()) {
                            this.hover_action = true;
                            this.openPopup();
                        }
                    });
                    marker.on('mouseout', function (e) {
                        if (this.hover_action)
                            this.closePopup();
                    });
                    active_layer.addLayer(marker);
                }
            })
        })
    }).catch(err => {
        console.log(err)
    })
}

async function login() {
    let username = document.getElementById("username").value.trim();
    let password = document.getElementById("password").value.trim();
    owner_key = await getPBKDF2("aag", username, 1000, 32);
    db_key = await getPBKDF2("aag", password, 1000, 32);
    return checkCredentials();
}

function handleKey(e) {
    if (e.keyCode == 13) {
        login();
    }
}

async function checkCredentials() {
    window.client = new Memri.default(owner_key, db_key, null, pod_url)
    let res = await test_connection();
    if (res) {
        show_reports();
        setInterval(() => {
            show_reports()  
        }, 10000)
        document.getElementById("login_layer").style.display = "none";
        document.cookie = "token=" + owner_key + ":" + db_key;
        logged_in = true;
    } else {
        document.getElementById("login_layer").style.display = "block";
        document.getElementById("login_message").innerHTML = "Girdiğiniz bilgileri kontrol ediniz.";
        logged_in = false;
    }
    return logged_in;
}

function zoom(delta) {
    map.zoomIn(delta);
}


function checkCookie() {
    let cookies = document.cookie.split(";");
    cookies.forEach(c => {
        kv = c.split("=");
        if (kv && kv.length == 2 && kv[0].trim() == "token") {
            let k = kv[1].trim().split(":");
            owner_key = k[0]
            db_key = k[1]
            checkCredentials();
        }
    });
}

function logout() {
    document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    location.reload();
}

window.onload = () => {
    checkCookie();
}
