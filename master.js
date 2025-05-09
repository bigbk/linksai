// VIN Research Hub - master.js
// This script handles VIN decoding, dynamic content display, and other interactive functionalities.

$(document).ready(function () {
    // --- Global Variables & Configuration ---
    var piserv = "https://73.39.163.6/"; 
    var awsserv = "http://3.16.31.159";  

    // --- VIN Decoding Logic ---
    const wmiToMake = {
        '1VW': 'VOLKSWAGEN', '3VW': 'VOLKSWAGEN', 'WAU': 'AUDI', 'WUA': 'AUDI', 'TRU': 'AUDI', 
        '2VW': 'VOLKSWAGEN', 
        '9BW': 'VOLKSWAGEN', 
        'WBA': 'BMW', 'WBS': 'BMW', 'WBX': 'BMW', 'WBY': 'BMW', 'WMW': 'MINI', 
        '4US': 'BMW', '5UX': 'BMW', '5YJ': 'TESLA', 
        '1C3': 'CHRYSLER', '1C4': 'CHRYSLER', '2C3': 'CHRYSLER', '3C4': 'CHRYSLER', 
        '1J4': 'JEEP', '1J8': 'JEEP', 
        'ZAR': 'ALFA ROMEO', 'ZFA': 'FIAT', 
        '1FA': 'FORD', '1FB': 'FORD', '1FC': 'FORD', '1FD': 'FORD', '1FM': 'FORD', '1FT': 'FORD', '1ZV': 'FORD', 
        '2FA': 'FORD', '3FA': 'FORD', 
        '1L': 'LINCOLN', '1LN': 'LINCOLN', 
        '1ME': 'MERCURY', 
        '1G1': 'CHEVROLET', '1GC': 'CHEVROLET', '1GN': 'CHEVROLET', '1GT': 'GMC', '1GY': 'CADILLAC', 
        '2G1': 'CHEVROLET', '2GC': 'CHEVROLET', '2GN': 'CHEVROLET', '2GT': 'GMC', '2GY': 'CADILLAC', 
        '3G1': 'CHEVROLET', '3GC': 'CHEVROLET', '3GN': 'CHEVROLET', '3GT': 'GMC', '3GY': 'CADILLAC', 
        'YS3': 'SAAB', 
        '1HG': 'HONDA', '1HF': 'HONDA', 'JH2': 'HONDA', 'JH4': 'ACURA', 
        'KMH': 'HYUNDAI', 'KMC': 'HYUNDAI', 'KNA': 'KIA', 'KND': 'KIA', 
        '5NM': 'HYUNDAI', '5NP': 'HYUNDAI', 
        'U5Y': 'KIA', 
        'MAL': 'HYUNDAI', 
        'KMG': 'GENESIS', 
        'JN1': 'NISSAN', 'JN6': 'NISSAN', 'JN8': 'INFINITI', 
        '5N1': 'NISSAN', '5N3': 'INFINITI', 
        'SAL': 'LAND ROVER', 'SAJ': 'JAGUAR', 
        'JT': 'TOYOTA', 'JTE': 'TOYOTA', 'JTL': 'TOYOTA', 'JTD': 'TOYOTA', 'JTH': 'LEXUS', 'JTK': 'SCION', 
        '4T1': 'TOYOTA', '4T3': 'TOYOTA', '5TB': 'TOYOTA', '5TD': 'TOYOTA', '5TF': 'TOYOTA', 
        '2T1': 'TOYOTA', 
        'JM1': 'MAZDA', 'JMZ': 'MAZDA', 
        '4F': 'MAZDA', 
        'WDD': 'MERCEDES-BENZ', 'WDB': 'MERCEDES-BENZ', 'WDC': 'MERCEDES-BENZ', 
        '4JG': 'MERCEDES-BENZ', '55S': 'MERCEDES-BENZ', 
        'JA3': 'MITSUBISHI', 'JA4': 'MITSUBISHI', 
        '4A3': 'MITSUBISHI', '4A4': 'MITSUBISHI', 
        'WP0': 'PORSCHE', 'WP1': 'PORSCHE', 
        'JF1': 'SUBARU', 'JF2': 'SUBARU', 
        '4S3': 'SUBARU', '4S4': 'SUBARU', 
        'YV1': 'VOLVO', 'YV4': 'VOLVO'
    };

    const makeToDivId = {
        'AUDI': 'audi_div',
        'VOLKSWAGEN': 'audi_div',
        'BENTLEY': 'audi_div',
        'BMW': 'bmw_div',
        'MINI': 'bmw_div',
        'CHRYSLER': 'chrysler_div',
        'JEEP': 'chrysler_div',
        'DODGE': 'chrysler_div',
        'RAM': 'chrysler_div',
        'FIAT': 'chrysler_div',
        'ALFA ROMEO': 'chrysler_div',
        'FORD': 'ford_div',
        'LINCOLN': 'ford_div',
        'MERCURY': 'ford_div',
        'GM': 'gm_div', 
        'CHEVROLET': 'gm_div',
        'GMC': 'gm_div',
        'CADILLAC': 'gm_div',
        'BUICK': 'gm_div',
        'PONTIAC': 'gm_div',
        'OLDSMOBILE': 'gm_div',
        'SATURN': 'gm_div',
        'SAAB': 'gm_div', 
        'HONDA': 'honda_div',
        'ACURA': 'honda_div',
        'HYUNDAI': 'hyundai_div',
        'GENESIS': 'hyundai_div', 
        'KIA': 'kia_div',
        'INFINITI': 'infiniti_div',
        'JAGUAR': 'jaguar_div',
        'LAND ROVER': 'landrover_div',
        'LEXUS': 'lexus_div',
        'SCION': 'lexus_div', 
        'MASERATI': 'maserati_div',
        'MAZDA': 'mazda_div',
        'MERCEDES-BENZ': 'mercedes_div',
        'MITSUBISHI': 'mitsubishi_div',
        'NISSAN': 'nissan_div',
        'PORSCHE': 'porsche_div',
        'SUBARU': 'subaru_div',
        'TESLA': 'tesla_div',
        'TOYOTA': 'toyota_div',
        'VOLVO': 'volvo_div',
        'COMMON': 'common_div' 
    };

    const allMakeDivIds = [...new Set(Object.values(makeToDivId))]; 

    // --- Core Display Functions ---
    window.hideAllMakeSpecificDivs = function() {
        allMakeDivIds.forEach(id => {
            // Only hide divs that are specifically for makes, not the general_links_div
            if (id !== 'general_links_div') { // Assuming 'general_links_div' is not in makeToDivId
                 $('#' + id).addClass('d-none');
            }
        });
         // Clear identified make text, but general links remain.
        $('#identifiedMake').text('');
    };

    window.showMakeSpecificDiv = function(make) {
        // First, hide all *other* make-specific divs and the common div
        allMakeDivIds.forEach(id => {
            $('#' + id).addClass('d-none');
        });
        
        const divId = makeToDivId[make.toUpperCase()]; 
        const commonDivId = makeToDivId['COMMON'];

        // Ensure general links div is visible
        $('#general_links_div').removeClass('d-none'); 

        if (divId) {
            $('#' + divId).removeClass('d-none'); // Show the target make-specific div
            $('#identifiedMake').text(`Identified Make: ${make} (Displaying specific & common links)`);
            // The line below was hiding the general links. It is now removed.
            // $('#general_links_div').addClass('d-none'); 
            
            if (commonDivId && divId !== commonDivId) { 
                $('#' + commonDivId).removeClass('d-none');
            }
        } else {
            $('#identifiedMake').text(`Make "${make}" not recognized. Showing general & common links.`);
            // General links are already ensured to be visible above.
            if (commonDivId) { 
                 $('#' + commonDivId).removeClass('d-none');
            }
        }
    };

    window.updateDisplay = function(makeKey) {
        const commonDivId = makeToDivId['COMMON'];

        if (makeKey === 'ALL' || !makeKey) {
            // Hide all make-specific divs (audi_div, bmw_div etc.)
            allMakeDivIds.forEach(id => {
                if (id !== commonDivId) { // Don't hide common_div yet if it's part of allMakeDivIds
                    $('#' + id).addClass('d-none');
                }
            });
            $('#general_links_div').removeClass('d-none'); 
            if (commonDivId) { 
                 $('#' + commonDivId).removeClass('d-none');
            }
            $('#identifiedMake').text('Showing General & Common Research Links');
        } else {
            showMakeSpecificDiv(makeKey); // This will handle showing the specific make and common, and keep general visible
        }
    };

    window.handleVinInput = function() {
        const vinValue = $('#VINbar').val().trim().toUpperCase();
        const commonDivId = makeToDivId['COMMON'];
        $('#general_links_div').removeClass('d-none'); // Always ensure general links are visible during VIN input

        if (vinValue.length === 0) {
            updateDisplay('ALL'); 
            return;
        }

        if (vinValue.length >= 3) { 
            const make = getMakeFromVin(vinValue);
            if (make) {
                showMakeSpecificDiv(make); // This will show specific, common, and keep general visible
            } else {
                $('#identifiedMake').text(`Typing VIN: ${vinValue.substring(0,3)}... (Make not yet identified)`);
                // Hide all specific make divs, but keep general and common visible
                allMakeDivIds.forEach(id => {
                     if (id !== commonDivId) {
                        $('#' + id).addClass('d-none');
                     }
                });
                if (commonDivId) { $('#' + commonDivId).removeClass('d-none'); } 
            }
        } else {
            $('#identifiedMake').text('Enter at least 3 characters of VIN...');
            allMakeDivIds.forEach(id => { // Hide all specific make divs
                 if (id !== commonDivId) {
                    $('#' + id).addClass('d-none');
                 }
            });
            if (commonDivId) { $('#' + commonDivId).removeClass('d-none'); } 
        }
    };

    window.processVinAndDisplay = function() {
        const vinValue = $('#VINbar').val().trim().toUpperCase();
        $('#VINbar').val(vinValue); 

        $('#general_links_div').removeClass('d-none'); // Ensure general links are visible after processing

        if (vinValue.length !== 17) {
            $('#output').html("<strong>Validation Error:</strong> Please enter a full 17-digit VIN.");
            $('#outputbox').fadeIn();
            updateDisplay('ALL'); 
            return;
        }

        const make = getMakeFromVin(vinValue);
        if (make) {
            showMakeSpecificDiv(make); // This will show specific, common, and keep general visible
            $('#output').html(`Displaying links for identified make: <strong>${make}</strong>.`);
            $('#outputbox').fadeIn().delay(2500).fadeOut(); 
        } else {
            $('#output').html(`<strong>Notice:</strong> Make not identified for this VIN. Showing general & common research links.`);
            $('#outputbox').fadeIn().delay(3500).fadeOut();
            updateDisplay('ALL'); 
        }

        if (typeof getNHTSADataByVIN === "function") {
            getNHTSADataByVIN(vinValue);
        } else {
            console.warn("getNHTSADataByVIN function is not defined. NHTSA data will not be fetched.");
        }
    };

    function getMakeFromVin(vin) {
        if (typeof vin !== 'string' || vin.length < 3) {
            return null;
        }
        const wmi = vin.substring(0, 3).toUpperCase();
        return wmiToMake[wmi] || null;
    }

    // --- Event Listeners ---
    $('#btn_submit').on('click', processVinAndDisplay);
    $('#VINbar').on('keypress', function(e) {
        if (e.which == 13) { 
            processVinAndDisplay();
            e.preventDefault(); 
        }
    });

    if (document.getElementById("kmxbutton")) {
        document.getElementById("kmxbutton").onclick = function () {
            var favorite = [];
            $.each($("input[name='options']:checked"), function () {
                favorite.push($(this).val());
            });
            var tcyl = document.getElementById("icyl").value ? "cylinders-" + document.getElementById("icyl").value : "";
            var carmaxUrl = "https://www.carmax.com/cars" +
                (document.getElementById("iyear").value ? "/" + document.getElementById("iyear").value : "") +
                (document.getElementById("imake").value ? "/" + document.getElementById("imake").value.replace(/ & /g, "-and-").replace(/ /g, "-") : "") + 
                (document.getElementById("imodel").value ? "/" + document.getElementById("imodel").value.replace(/ & /g, "-and-").replace(/ /g, "-") : "") +
                (document.getElementById("itrim").value ? "/" + document.getElementById("itrim").value.replace(/ & /g, "-and-").replace(/ /g, "-") : "") +
                (tcyl ? "/" + tcyl : "") +
                (favorite.length > 0 ? "/" + favorite.join("/") : "") +
                "?zip=21162&sort=4&distance=all"; 
            window.open(carmaxUrl, '_blank');
        };
    }
    
    // --- Make-Specific Link Functions & JSON Fetch Helper ---
    function getVinOrAlert() {
        const vinValue = $('#VINbar').val().trim().toUpperCase();
        if (vinValue.length === 17) {
            return vinValue;
        } else {
            $('#output').html("<strong>VIN Required:</strong> Please enter a valid 17-digit VIN before using this link.");
            $('#outputbox').stop().fadeIn(); 
            return null;
        }
    }

    function attemptJsonFetch(url, makeName) {
        $('#output').html(`Attempting to fetch ${makeName} data... <small>(May be blocked by browser or API changes)</small>`);
        $('#outputbox').stop().fadeIn();
        
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    let errorDetail = `Network response was not ok: ${response.status} ${response.statusText}`;
                    if (response.type === 'opaque') { 
                        errorDetail = "Received an opaque response, likely due to CORS. Cannot read data.";
                    }
                    throw new Error(errorDetail);
                }
                return response.json();
            })
            .then(data => {
                console.log(`${makeName} Data Received:`, data);
                $('#output').html(`<strong>${makeName} Data Received (JSON):</strong><br><pre>${JSON.stringify(data, null, 2)}</pre>`);
                $('#outputbox').stop().fadeIn(); 
            })
            .catch(error => {
                console.error(`Error fetching ${makeName} data:`, error);
                $('#output').html(
                    `<strong>Could not fetch ${makeName} data directly.</strong><br>` +
                    `<small>This can happen due to browser security (CORS), API changes, or network issues.</small><br>` +
                    `You can try to access the data directly by clicking here: ` +
                    `<a href="${url}" target="_blank" class="text-warning fw-bold">Open ${makeName} Data Link</a><br>` +
                    `<small>Error details: ${error.message}</small>`
                );
                $('#outputbox').stop().fadeIn();
            });
    }

    // --- Individual Make/Link Functions ---
    window.vwaudilane = function () { const vin = getVinOrAlert(); if (vin) window.open('http://webtest1.audi.com.edgesuite.net/acf012/v1/applications/vindecoder/default/details/' + vin + '/CA/EN', '_blank'); };
    window.bimmerbtn = function () { const vin = getVinOrAlert(); if (vin) window.open('https://www.mdecoder.com/decode/' + vin, '_blank'); };
    window.bmwlane = function () { const vin = getVinOrAlert(); if (vin) window.open('http://www.nadeauto.com/MonroneySticker/MonroneyStickerRequestHandler.ashx?vin=' + vin + '&make=BMW&img=1', '_blank'); };
    window.miniog = function() {
        var myear = $("#myear").val(); var mmodel = $("#mmodel").val();
        if(myear && mmodel) { window.open('https://www.google.com/search?q=' + encodeURIComponent(myear + ' ' + mmodel + ' mini cooper ordering guide site:minif56.com'), '_blank'); } 
        else { alert("Please enter Year and Model for MINI Guide Search."); }
    };
    window.chrysler = function () { const vin = getVinOrAlert(); if (vin) window.open('https://www.chrysler.com/hostd/windowsticker/getWindowStickerPdf.do?vin=' + vin, '_blank'); };
    window.chryslerlist = function () { const vin = getVinOrAlert(); if (vin) window.open('https://www.jeep.com/webselfservice/BuildSheetServlet?vin=' + vin, '_blank'); };
    window.chryslerlist2 = function () { const vin = getVinOrAlert(); if (vin) window.open('https://www.ramtrucks.com/webselfservice/BuildSheetServlet?vin=' + vin, '_blank'); };
    window.chryslerlist3 = function () { const vin = getVinOrAlert(); if (vin) window.open('https://www.dodge.com/webselfservice/BuildSheetServlet?vin=' + vin, '_blank'); };
    window.fordwiki = function () { const vin = getVinOrAlert(); if (vin) window.open('https://www.windowsticker.forddirect.com/windowsticker.pdf?vin=' + vin, '_blank'); };
    window.ford = function () { const vin = getVinOrAlert(); if (vin) window.open('https://www.motorcraftservice.com/Home/SetCountry?returnUrl=%2FAsBuilt%3Fvin%3D' + vin, '_blank'); };
    window.fordsticker = function () { const vin = getVinOrAlert(); if (vin) window.open('https://www.inventory.ford.com/services/inventory/v2/windowsticker/' + vin + '?dealerId=XXXXX', '_blank'); };
    window.fordstickerkey = function () { const vin = getVinOrAlert(); if (vin) window.open('https://api.concentrix.ford.com/v1.0/vehicle/vin/' + vin + '/details', '_blank'); };
    window.fordstickerkey2 = function () {
        const vin = getVinOrAlert(); const mkey = $('#mkey').val().trim();
        if (vin && mkey.length > 0) { let url = 'https://api.concentrix.ford.com/v1.0/vehicle/vin/' + vin + '/details'; alert("Opening Concentrix URL. Authentication/headers may be required: " + url + " with key: " + mkey); window.open(url, '_blank'); } 
        else if (vin && mkey.length === 0) { alert("Please enter the Concentrix key."); }
    };
    window.gmlink2 = function () { const vin = getVinOrAlert(); if (vin) window.open('https://www.gmpartsrebates.com/MonroneySticker/MonroneyStickerRequestHandler.ashx?vin=' + vin, '_blank'); };
    window.gmlink = function () { const vin = getVinOrAlert(); if (vin) window.open('https://www.gmremarketing.com/MonroneySticker/MonroneyStickerRequestHandler.ashx?vin=' + vin + '&make=SAAB', '_blank'); };
    
    window.honda2 = function () { const vin = getVinOrAlert(); if (vin) attemptJsonFetch('https://www.hondaautomobileparts.com/json/vars.aspx?vin=' + vin + '&dl=true', 'Honda'); };
    window.acura = function () { const vin = getVinOrAlert(); if (vin) attemptJsonFetch('https://www.acuraautomobileparts.com/json/vars.aspx?vin=' + vin + '&dl=true', 'Acura'); };
    window.hyunwiki = function () { const vin = getVinOrAlert(); if (vin) attemptJsonFetch('https://www.hyundaiusa.com/var/hyundai/services/inventory/vehicleDetailsByVin.json?vin=' + vin, 'Hyundai'); };
    
    window.getnissansticker4 = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.nissanusa.com/owners/forms/window-sticker-lookup.html?vin=' + vin, '_blank'); };
    window.infiniti = function() { const vin = getVinOrAlert(); if(vin) { alert("Infiniti specific sticker link pattern needs verification. Opening general lookup."); window.open('https://www.infinitiusa.com/owners/ownership/manuals-guides.html', '_blank'); } };
    window.infinititrm = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.infinitiusa.com/owners/vehicle-resources/recall-information.html?dcp=sn_258_RECALLS&uuid=ONLINE_SEARCH_FORM&vin=' + vin, '_blank'); };
    window.kiabtn2 = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.kia.com/us/en/services/kia-owner-portal/information?vin=' + vin, '_blank'); };
    window.maserati = function() { const vin = getVinOrAlert(); if(vin) { alert("Maserati window sticker links are typically dealer-specific. Searching Google for dealer inventory."); window.open('https://www.google.com/search?q=maserati+dealer+inventory+window+sticker+' + vin, '_blank'); } };
    window.mazdabtn2 = function() { alert("Mazda alternate window sticker link is currently unavailable (as per original notes)."); };
    window.mazdabtn = function() { const vin = getVinOrAlert(); if(vin) { alert("Mazda dealer inventory sticker link needs specific dealer portal. Searching Google."); window.open('https://www.google.com/search?q=mazda+dealer+inventory+window+sticker+' + vin, '_blank'); } };
    window.decoderz = function() { const vin = getVinOrAlert(); if(vin) window.open('https://vindecoderz.com/EN/check-lookup/' + vin, '_blank'); };
    window.mitsbtn = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.mitsubishicars.com/owners/service/recalls?vin=' + vin, '_blank'); };
    window.nissan = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.nissanusa.com/owners/forms/window-sticker-lookup.html?vin=' + vin, '_blank'); };
    window.nissantrm = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.nissanusa.com/owners/vehicle-resources/recall-lookup.html?vin=' + vin, '_blank'); };
    window.porwiki = function() { const vin = getVinOrAlert(); if(vin) { alert("Porsche window sticker links are typically dealer-specific or require login. Searching Porsche USA."); window.open('https://www.porsche.com/usa/accessoriesandservices/porscheservice/vehicleinformation/originalvehicleinformation/', '_blank'); } };
    window.subaru2 = function() { const vin = getVinOrAlert(); if (vin) { alert("Subaru JSON trim link pattern needs verification. Opening recall site."); window.open('https://www.subaru.com/owners/vehicle-resources/recalls.html?vin=' + vin, '_blank'); } };
    window.subaru = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.subaru.com/owners/vehicle-resources/recalls.html?vin=' + vin, '_blank'); };
    window.subarusticker = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.subaruwindowsticker.com/parse.php?vin=' + vin, '_blank'); };
    window.tesla = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.tesla.com/vin/' + vin, '_blank'); };
    window.teslam = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.tesla.com/ownersmanual', '_blank'); };
    window.tesla2 = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.google.com/search?q=tesla+vin+' + vin + '+for+sale+history', '_blank'); };
    window.toyotasticker = function() { const vin = getVinOrAlert(); if(vin) window.open('https://api.toyotainventory.com/vehicles/' + vin + '/monroney', '_blank'); };
    window.toyotasticker3 = function() { const vin = getVinOrAlert(); if(vin) { alert("DealerSocket/DealerFire Toyota sticker links vary by dealer. Searching Google."); window.open('https://www.google.com/search?q=toyota+dealersocket+window+sticker+' + vin, '_blank'); } };
    window.volvosticker = function() { const vin = getVinOrAlert(); if(vin) window.open('https://volvo.custhelp.com/app/answers/detail/a_id/9005/~/how-do-i-get-a-window-sticker-%28monroney-label%29-for-my-volvo%3F', '_blank'); };
    
    window.velocitysticker = function() { const vin = getVinOrAlert(); if(vin) alert("Velocity sticker link requires dealer login/access. This is a placeholder."); };
    window.autobrochures = function() { window.open('http://www.auto-brochures.com/', '_blank'); };
    window.manheimmmr = function() { const vin = getVinOrAlert(); if(vin) window.open('https://mmr.manheim.com/#!/vdp?vin=' + vin, '_blank'); };
    window.hclutch = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.vehiclehistory.com/vehicle/history-report-by-vin/' + vin, '_blank'); };
    window.siriusxm = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.siriusxm.com/vehicleavailability?vin=' + vin, '_blank'); };
    window.hitcher = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.etrailer.com/vehicle-fit-guide.aspx?vin=' + vin, '_blank'); };
    
    window.invoice = function() { const vin = getVinOrAlert(); if(vin) window.open('http://www.blackbookportals.com/bb/products/newcarhtmlportal.asp?color=o&companyid=MAYO&vin=' + vin, '_blank'); };
    window.bidhistory = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.bidhistory.com/search?q=' + vin, '_blank'); };
    window.manheimsearch = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.manheim.com/members/search_results?vin=' + vin, '_blank'); };

    // --- NHTSA Data Fetching Function ---
    window.getNHTSADataByVIN = function(vinToQuery) {
        $('#txt_results').val(`Fetching NHTSA data for VIN: ${vinToQuery}...`);
        const nhtsaApiUrl = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vinToQuery}?format=json`;

        fetch(nhtsaApiUrl)
            .then(response => {
                if (!response.ok) { throw new Error(`NHTSA API response error: ${response.status} ${response.statusText}`); }
                return response.json();
            })
            .then(data => {
                if (data && data.Results && data.Results.length > 0) {
                    let formattedResults = `NHTSA Decoded VIN: ${vinToQuery}\n\n`;
                    const vehicleData = data.Results[0];
                    const fieldsToShow = ['Make', 'Model', 'ModelYear', 'Manufacturer', 'VehicleType', 'BodyClass', 'DriveType', 'EngineCylinders', 'FuelTypePrimary', 'PlantCity', 'PlantCountry'];
                    fieldsToShow.forEach(field => {
                        if (vehicleData[field]) {
                            formattedResults += `${field.replace(/([A-Z])/g, ' $1').trim()}: ${vehicleData[field]}\n`; // Add space before caps
                        }
                    });
                    $('#txt_results').val(formattedResults.trim());
                } else {
                    $('#txt_results').val(`No detailed results from NHTSA for VIN: ${vinToQuery}. Message: ${data.Message || ''}`);
                }
            })
            .catch(error => {
                console.error("Error fetching NHTSA data:", error);
                $('#txt_results').val(`Error fetching NHTSA data for VIN: ${vinToQuery}.\n${error.message}`);
            });
    };

    updateDisplay('ALL'); 
});
