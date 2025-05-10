// VIN Research Hub - master.js
// This script handles VIN decoding, dynamic content display, and other interactive functionalities.

$(document).ready(function () {
    // --- Global Variables & Configuration ---
    var piserv = "https://73.39.163.6/"; 
    var awsserv = "http://3.16.31.159";  

    // --- VIN Decoding Logic ---
    // wmiToMake: Maps World Manufacturer Identifier (first 3 VIN chars) to a Make.
    const wmiToMake = {
        // Volkswagen Group
        '1VW': 'VOLKSWAGEN', '3VW': 'VOLKSWAGEN', // VW USA/Mexico
        'WAU': 'AUDI', 'WUA': 'AUDI', 'TRU': 'AUDI', // Audi Germany/Hungary
        '2VW': 'VOLKSWAGEN', // VW Canada
        '9BW': 'VOLKSWAGEN', // VW Brazil
        'WVW': 'VOLKSWAGEN', // VW Germany Passenger Cars
        'WVG': 'VOLKSWAGEN', // VW Germany SUVs/Touran
        'WV1': 'VOLKSWAGEN', // VW Commercial Germany
        'WV2': 'VOLKSWAGEN', // VW Commercial Germany
        'AAV': 'VOLKSWAGEN', // VW South Africa
        'SAL': 'LAND ROVER', // Often VW Group for some components, but primary ID for Land Rover
        'SCB': 'BENTLEY',    // Bentley (UK, under VW Group)
        'WP0': 'PORSCHE', 'WP1': 'PORSCHE', // Porsche (Germany, under VW Group)
        'VSS': 'SEAT',       // Seat (Spain, under VW Group)
        'TMB': 'SKODA',      // Skoda (Czech Republic, under VW Group)
        'ZHW': 'LAMBORGHINI',// Lamborghini (Italy, under VW Group) - Note: Some start with ZA9

        // BMW Group
        'WBA': 'BMW', 'WBS': 'BMW', // BMW Germany (WBS often BMW M)
        'WBX': 'BMW', 'WBY': 'BMW', 
        'WMW': 'MINI',       // MINI (UK/Netherlands, under BMW Group)
        // 'WBY': 'BMW',        // BMW Motorcycles (Germany) - Example, ensure context. This WBY is typically cars.
        '4US': 'BMW',        // BMW USA (Spartanburg)
        '5UX': 'BMW',        // BMW USA (Spartanburg SUVs)
        '3AV': 'BMW',        // BMW Mexico
        'X4X': 'BMW',        // BMW Russia (Kaliningrad) - Status may vary

        // Stellantis (formerly FCA - Chrysler, Jeep, Dodge, Ram, Fiat, Alfa Romeo, Peugeot, Citroen, etc.)
        // Chrysler
        '1C3': 'CHRYSLER', '1C4': 'CHRYSLER', '2C3': 'CHRYSLER', '3C4': 'CHRYSLER',
        // Dodge
        '1B3': 'DODGE', '2B3': 'DODGE', '3B3': 'DODGE', // Dodge Cars
        '1D3': 'DODGE', // Older Dodge Trucks (pre-Ram separation)
        // Jeep
        '1J4': 'JEEP', '1J8': 'JEEP', '3J4': 'JEEP',
        // Ram
        '1C6': 'RAM', '2C6': 'RAM', '3C6': 'RAM', // Ram Trucks
        // Fiat
        'ZFA': 'FIAT',       // Fiat Italy
        '1F9': 'FIAT',       // Fiat USA (e.g., 500L)
        '3F9': 'FIAT',       // Fiat Mexico (e.g., for NA market)
        // Alfa Romeo
        'ZAR': 'ALFA ROMEO', // Alfa Romeo Italy
        // Other Stellantis (Examples, list can be very long)
        'VF1': 'RENAULT',    // Renault (often associated due to past/present alliances, but distinct)
        'VF3': 'PEUGEOT',    // Peugeot France
        'VF7': 'CITROEN',    // Citroen France
        'ZCG': 'LANCIA',     // Lancia Italy

        // Ford Motor Company
        '1FA': 'FORD', '1FB': 'FORD', '1FC': 'FORD', '1FD': 'FORD', '1FM': 'FORD', '1FT': 'FORD', '1ZV': 'FORD', // Ford USA
        '2FA': 'FORD', '3FA': 'FORD', // Ford Canada, Mexico
        'WF0': 'FORD',       // Ford Germany
        'SFA': 'FORD',       // Ford UK
        'NM0': 'FORD',       // Ford Turkey
        'MAJ': 'FORD',       // Ford India
        '1L': 'LINCOLN', '1LN': 'LINCOLN', // Lincoln USA
        '1ME': 'MERCURY',    // Mercury USA (Discontinued)

        // General Motors (GM)
        // Chevrolet
        '1G1': 'CHEVROLET', '1GC': 'CHEVROLET', '1GN': 'CHEVROLET',
        '2G1': 'CHEVROLET', '2GC': 'CHEVROLET', '2GN': 'CHEVROLET', // Canada
        '3G1': 'CHEVROLET', '3GC': 'CHEVROLET', '3GN': 'CHEVROLET', // Mexico
        'KL1': 'CHEVROLET',  // Daewoo/GM Korea (e.g., Spark, Aveo)
        // GMC
        '1GT': 'GMC', '2GT': 'GMC', '3GT': 'GMC',
        // Cadillac
        '1GY': 'CADILLAC', '2GY': 'CADILLAC', '3GY': 'CADILLAC',
        // Buick
        '1G4': 'BUICK', '2G4': 'BUICK', '3G4': 'BUICK', // Buick North America
        'LSG': 'BUICK',      // Buick China (SAIC-GM)
        // Pontiac (Discontinued)
        '1G2': 'PONTIAC', '2G2': 'PONTIAC', '3G2': 'PONTIAC',
        // Oldsmobile (Discontinued)
        '1G3': 'OLDSMOBILE',
        // Saturn (Discontinued)
        '1G8': 'SATURN',
        // Holden (Australia - Discontinued)
        '6G1': 'HOLDEN', '6H8': 'HOLDEN',
        // Saab (Formerly GM)
        'YS3': 'SAAB',

        // Honda / Acura
        '1HG': 'HONDA', '1HF': 'HONDA', // Honda USA
        'JH2': 'HONDA',      // Honda Japan (Cars)
        'JH4': 'ACURA',      // Acura Japan (Often for MDX, etc.)
        '2HG': 'HONDA',      // Honda Canada
        '3HG': 'HONDA',      // Honda Mexico
        'SHH': 'HONDA',      // Honda UK
        '19U': 'ACURA',      // Acura USA (e.g., some sedans)

        // Hyundai / Kia / Genesis
        'KMH': 'HYUNDAI', 'KMC': 'HYUNDAI', // Hyundai Korea
        '5NM': 'HYUNDAI', '5NP': 'HYUNDAI', // Hyundai USA
        'MAL': 'HYUNDAI',    // Hyundai India
        'KNA': 'KIA', 'KND': 'KIA',       // Kia Korea
        'U5Y': 'KIA',        // Kia USA (West Point, GA)
        'KMG': 'GENESIS',    // Genesis Korea
        'KM8': 'GENESIS',    // Genesis Korea (another common one)
        
        // Nissan / Infiniti
        'JN1': 'NISSAN', 'JN6': 'NISSAN', 'JN8': 'INFINITI', // Nissan/Infiniti Japan
        '5N1': 'NISSAN', '5N3': 'INFINITI', // Nissan/Infiniti USA
        'VSK': 'NISSAN',     // Nissan Spain
        'SJN': 'NISSAN',     // Nissan UK

        // Jaguar Land Rover (JLR - Tata Motors)
        'SAJ': 'JAGUAR',     // Jaguar UK
        'SCA': 'LAND ROVER', // Land Rover UK (another one)

        // Toyota / Lexus / Scion
        'JT': 'TOYOTA', 'JTE': 'TOYOTA', 'JTL': 'TOYOTA', 'JTD': 'TOYOTA', // Toyota Japan
        'JTH': 'LEXUS',      // Lexus Japan
        'JTK': 'SCION',      // Scion Japan (Discontinued)
        '4T1': 'TOYOTA', '4T3': 'TOYOTA', // Toyota USA
        '5TB': 'TOYOTA', '5TD': 'TOYOTA', '5TF': 'TOYOTA', // Toyota USA (Trucks/SUVs)
        '2T1': 'TOYOTA',     // Toyota Canada
        'SB1': 'TOYOTA',     // Toyota UK

        // Mazda
        'JM1': 'MAZDA', 'JMZ': 'MAZDA', // Mazda Japan
        '4F': 'MAZDA',       // Mazda USA (Flat Rock, MI - often shared plant)
        '3MD': 'MAZDA',      // Mazda Mexico

        // Mercedes-Benz Group
        'WDD': 'MERCEDES-BENZ', 'WDB': 'MERCEDES-BENZ', 'WDC': 'MERCEDES-BENZ', // Mercedes Germany
        '4JG': 'MERCEDES-BENZ', '55S': 'MERCEDES-BENZ', // Mercedes USA
        'NMB': 'MERCEDES-BENZ', // Mercedes Turkey (Buses)

        // Mitsubishi
        'JA3': 'MITSUBISHI', 'JA4': 'MITSUBISHI', // Mitsubishi Japan
        '4A3': 'MITSUBISHI', '4A4': 'MITSUBISHI', // Mitsubishi USA (formerly Normal, IL)

        // Subaru
        'JF1': 'SUBARU', 'JF2': 'SUBARU', // Subaru Japan
        '4S3': 'SUBARU', '4S4': 'SUBARU', // Subaru USA (Lafayette, IN)

        // Tesla
        '5YJ': 'TESLA',      // Tesla USA (Fremont, CA & some older Austin)
        '7SA': 'TESLA',      // Tesla USA (Austin, TX & some newer Fremont)
        'LRW': 'TESLA',      // Tesla China (Shanghai)
        'XP7': 'TESLA',      // Tesla Germany (Berlin)

        // Volvo (Geely)
        'YV1': 'VOLVO', 'YV4': 'VOLVO', // Volvo Sweden
        'YV2': 'VOLVO', 'YV3': 'VOLVO', // Volvo Sweden (Trucks/Buses)
        'LPS': 'POLESTAR',   // Polestar China (Geely/Volvo) - May also appear as Volvo
        'YSM': 'POLESTAR',   // Polestar Sweden (Design/Engineering - Production often China/US)

        // Newer EV Manufacturers (Examples)
        '7FC': 'RIVIAN',     // Rivian (USA) - Note: Full code often 7FCTG...
        '5L1': 'LUCID',      // Lucid Motors (USA)
        'NVV': 'VINFAST',    // VinFast (Vietnam/USA)
        
        // Other Manufacturers (Examples)
        'SDB': 'PEUGEOT',    // Peugeot UK (Ryton, now closed, but VINs exist)
        'SUU': 'ISUZU',      // Isuzu Poland (often for engines/components, some vehicles)
        'TMT': 'TATRA',      // Tatra (Czech Republic)
        'XL9': 'SPYKER',     // Spyker (Netherlands)
        'SCC': 'LOTUS',      // Lotus (UK)
        'ZAM': 'MASERATI'    // Maserati Italy (another common one besides what's in makeToDivId)
    };

    const makeToDivId = {
        'AUDI': 'audi_div',
        'VOLKSWAGEN': 'audi_div', 
        'BENTLEY': 'audi_div',
        'PORSCHE': 'porsche_div', 
        'SEAT': 'audi_div', 
        'SKODA': 'audi_div', 
        'LAMBORGHINI': 'audi_div',
        'BMW': 'bmw_div',
        'MINI': 'bmw_div',
        'CHRYSLER': 'chrysler_div',
        'JEEP': 'chrysler_div',
        'DODGE': 'chrysler_div',
        'RAM': 'chrysler_div',
        'FIAT': 'chrysler_div',
        'ALFA ROMEO': 'chrysler_div',
        'PEUGEOT': 'chrysler_div', 
        'CITROEN': 'chrysler_div',
        'LANCIA': 'chrysler_div', 
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
        'HOLDEN': 'gm_div',
        'SAAB': 'gm_div', 
        'HONDA': 'honda_div',
        'ACURA': 'honda_div',
        'HYUNDAI': 'hyundai_div',
        'GENESIS': 'hyundai_div', 
        'KIA': 'kia_div',
        'INFINITI': 'infiniti_div',
        'NISSAN': 'nissan_div',
        'JAGUAR': 'jaguar_div',
        'LAND ROVER': 'landrover_div',
        'LEXUS': 'lexus_div',
        'SCION': 'lexus_div', 
        'TOYOTA': 'toyota_div',
        'MASERATI': 'maserati_div',
        'MAZDA': 'mazda_div',
        'MERCEDES-BENZ': 'mercedes_div',
        'MITSUBISHI': 'mitsubishi_div',
        'SUBARU': 'subaru_div',
        'TESLA': 'tesla_div',
        'VOLVO': 'volvo_div',
        'POLESTAR': 'volvo_div', 
        'RIVIAN': 'tesla_div', 
        'LUCID': 'tesla_div',  
        'VINFAST': 'hyundai_div', 
        'RENAULT': 'nissan_div', 
        'ISUZU': 'gm_div', 
        'TATRA': 'common_div', 
        'SPYKER': 'common_div',
        'LOTUS': 'common_div',
        'COMMON': 'common_div' 
    };

    const allMakeDivIds = [...new Set(Object.values(makeToDivId))]; 

    // --- Core Display Functions ---
    window.hideAllMakeSpecificDivs = function() {
        allMakeDivIds.forEach(id => {
            if (id !== 'general_links_div') { 
                 $('#' + id).addClass('d-none');
            }
        });
        $('#identifiedMake').text('');
    };

    window.showMakeSpecificDiv = function(make) {
        allMakeDivIds.forEach(id => {
            $('#' + id).addClass('d-none');
        });
        
        const divId = makeToDivId[make.toUpperCase()]; 
        const commonDivId = makeToDivId['COMMON'];

        $('#general_links_div').removeClass('d-none'); 

        if (divId) {
            $('#' + divId).removeClass('d-none'); 
            $('#identifiedMake').text(`Identified Make: ${make} (Displaying specific & common links)`);
            
            if (commonDivId && divId !== commonDivId) { 
                $('#' + commonDivId).removeClass('d-none');
            }
        } else {
            $('#identifiedMake').text(`Make "${make}" not recognized. Showing general & common links.`);
            if (commonDivId) { 
                 $('#' + commonDivId).removeClass('d-none');
            }
        }
    };

    window.updateDisplay = function(makeKey) {
        const commonDivId = makeToDivId['COMMON'];

        if (makeKey === 'ALL' || !makeKey) {
            allMakeDivIds.forEach(id => {
                if (id !== commonDivId) { 
                    $('#' + id).addClass('d-none');
                }
            });
            $('#general_links_div').removeClass('d-none'); 
            if (commonDivId) { 
                 $('#' + commonDivId).removeClass('d-none');
            }
            $('#identifiedMake').text('Showing General & Common Research Links');
        } else {
            showMakeSpecificDiv(makeKey); 
        }
    };

    window.handleVinInput = function() {
        const vinValue = $('#VINbar').val().trim().toUpperCase();
        const commonDivId = makeToDivId['COMMON'];
        $('#general_links_div').removeClass('d-none'); 

        if (vinValue.length === 0) {
            updateDisplay('ALL'); 
            return;
        }

        if (vinValue.length >= 3) { 
            const make = getMakeFromVin(vinValue);
            if (make) {
                showMakeSpecificDiv(make); 
            } else {
                $('#identifiedMake').text(`Typing VIN: ${vinValue.substring(0,3)}... (Make not yet identified)`);
                allMakeDivIds.forEach(id => {
                     if (id !== commonDivId) {
                        $('#' + id).addClass('d-none');
                     }
                });
                if (commonDivId) { $('#' + commonDivId).removeClass('d-none'); } 
            }
        } else {
            $('#identifiedMake').text('Enter at least 3 characters of VIN...');
            allMakeDivIds.forEach(id => { 
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

        $('#general_links_div').removeClass('d-none'); 

        if (vinValue.length !== 17) {
            $('#output').html("<strong>Validation Error:</strong> Please enter a full 17-digit VIN.");
            $('#outputbox').fadeIn();
            updateDisplay('ALL'); 
            return;
        }

        const make = getMakeFromVin(vinValue);
        if (make) {
            showMakeSpecificDiv(make); 
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
    // Window sticker links are set to reflect original preferences where possible,
    // except for Mazda and Volvo which retain their v6 logic.

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
    
    // Hyundai: Using a direct PDF attempt pattern as per "original link" spirit (same as v6)
    window.hyunwiki = function () { 
        const vin = getVinOrAlert(); 
        if (vin) window.open('https://www.hyundaiusa.com/var/hyundai/services/monroney/getWindowStickerByVin.pdf?vin=' + vin, '_blank'); 
    }; 
    
    // Nissan & Infiniti: Attempting direct PDF patterns.
    window.getnissansticker4 = function() { // This was used for both Nissan and Infiniti in original HTML
        const vin = getVinOrAlert(); 
        if(vin) window.open('https://www.nissanusa.com/pdf/windowsticker?vin=' + vin, '_blank'); // Attempt direct Nissan PDF
    }; 
    window.infiniti = function() { 
        const vin = getVinOrAlert(); 
        // Attempt a known (though sometimes unreliable) Infiniti API endpoint for stickers
        if(vin) window.open('https://www.infinitiusa.com/now/api/vehicles/windowsticker/' + vin, '_blank'); 
    };
    window.infinititrm = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.infinitiusa.com/owners/vehicle-resources/recall-information.html?dcp=sn_258_RECALLS&uuid=ONLINE_SEARCH_FORM&vin=' + vin, '_blank'); }; 
    
    // Kia: Using a direct PDF attempt pattern as per "original link" spirit (same as v6)
    window.kiabtn2 = function() { 
        const vin = getVinOrAlert(); 
        if(vin) window.open('https://www.kia.com/us/en/services/ownerportal/loadVehicleSticker?vin=' + vin, '_blank'); 
    };
    
    window.maserati = function() { 
        const vin = getVinOrAlert(); 
        if(vin) { 
            // Direct public Maserati stickers are very rare. Original likely had a non-functional direct attempt or a general search.
            // Reverting to a Google search as a pragmatic "original-like" fallback for difficult ones.
            alert("Maserati window sticker links are typically dealer-specific or require login. Searching Google for dealer inventory."); 
            window.open('https://www.google.com/search?q=maserati+dealer+inventory+window+sticker+' + vin, '_blank'); 
        } 
    };
    
    // Mazda: Retain v6 logic (alert for mazdabtn2, Google search for mazdabtn)
    window.mazdabtn2 = function() { alert("Mazda alternate window sticker link is currently unavailable (as per original notes)."); };
    window.mazdabtn = function() { const vin = getVinOrAlert(); if(vin) { alert("Mazda dealer inventory sticker link needs specific dealer portal. Searching Google."); window.open('https://www.google.com/search?q=mazda+dealer+inventory+window+sticker+' + vin, '_blank'); } };
    
    window.decoderz = function() { const vin = getVinOrAlert(); if(vin) window.open('https://vindecoderz.com/EN/check-lookup/' + vin, '_blank'); }; 
    
    // Mitsubishi: Using a direct sticker link pattern as per "original link" spirit (same as v6)
    window.mitsbtn = function() { 
        const vin = getVinOrAlert(); 
        if(vin) window.open('https://www.mitsubishicars.com/rs/file/monroney?vin=' + vin, '_blank'); 
    };
    
    // Nissan (alternative, if getnissansticker4 is preferred for some contexts)
    window.nissan = function() { 
        const vin = getVinOrAlert(); 
        if(vin) window.open('https://www.nissanusa.com/pdf/windowsticker?vin=' + vin, '_blank'); // Attempt direct Nissan PDF
    };
    window.nissantrm = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.nissanusa.com/owners/vehicle-resources/recall-lookup.html?vin=' + vin, '_blank'); }; 
    window.porwiki = function() { 
        const vin = getVinOrAlert(); 
        if(vin) { 
            // Direct public Porsche stickers are very rare. Original likely had a non-functional direct attempt or a general search.
            alert("Porsche window sticker links are typically dealer-specific or require login. Opening Porsche USA vehicle information page."); 
            window.open('https://www.porsche.com/usa/accessoriesandservices/porscheservice/vehicleinformation/originalvehicleinformation/', '_blank'); 
        } 
    };
    window.subaru2 = function() { const vin = getVinOrAlert(); if (vin) { alert("Subaru JSON trim link pattern needs verification. Opening recall site."); window.open('https://www.subaru.com/owners/vehicle-resources/recalls.html?vin=' + vin, '_blank'); } }; 
    window.subaru = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.subaru.com/owners/vehicle-resources/recalls.html?vin=' + vin, '_blank'); }; 
    window.subarusticker = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.subaruwindowsticker.com/parse.php?vin=' + vin, '_blank'); }; 
    
    window.tesla = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.tesla.com/vin/' + vin, '_blank'); }; 
    window.teslam = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.tesla.com/ownersmanual', '_blank'); }; 
    window.tesla2 = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.google.com/search?q=tesla+vin+' + vin + '+for+sale+history', '_blank'); }; 
    
    window.toyotasticker = function() { const vin = getVinOrAlert(); if(vin) window.open('https://api.toyotainventory.com/vehicles/' + vin + '/monroney', '_blank'); }; 
    window.toyotasticker3 = function() { const vin = getVinOrAlert(); if(vin) { alert("DealerSocket/DealerFire Toyota sticker links vary by dealer. Searching Google."); window.open('https://www.google.com/search?q=toyota+dealersocket+window+sticker+' + vin, '_blank'); } };
    
    // Volvo: Retain v6 logic (info page)
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
                            formattedResults += `${field.replace(/([A-Z])/g, ' $1').trim()}: ${vehicleData[field]}\n`; 
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
