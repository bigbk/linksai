// Ensure this script is loaded after jQuery
$(document).ready(function () {
    // --- VIN Decoding Logic ---
    // Simplified WMI to Make mapping. Consider expanding or using a more robust solution/API for production.
    const wmiToMake = {
        '1VW': 'VOLKSWAGEN', '3VW': 'VOLKSWAGEN', 'WAU': 'AUDI', 'WUA': 'AUDI', 'TRU': 'AUDI', // Audi/VW Group
        '2VW': 'VOLKSWAGEN', // Canada
        '9BW': 'VOLKSWAGEN', // Brazil
        'WBA': 'BMW', 'WBS': 'BMW M', 'WBX': 'BMW', 'WBY': 'BMW', 'WMW': 'MINI', // BMW Group
        '4US': 'BMW', '5UX': 'BMW', '5YJ': 'BMW', // BMW US
        '1C3': 'CHRYSLER', '1C4': 'CHRYSLER', '2C3': 'CHRYSLER', '3C4': 'CHRYSLER', // Chrysler
        '1J4': 'JEEP', '1J8': 'JEEP', // Jeep
        'ZAR': 'ALFA ROMEO', 'ZFA': 'FIAT', // Fiat/Alfa
        '1FA': 'FORD', '1FB': 'FORD', '1FC': 'FORD', '1FD': 'FORD', '1FM': 'FORD', '1FT': 'FORD', '1ZV': 'FORD', // Ford
        '2FA': 'FORD', '3FA': 'FORD', // Ford
        '1L': 'LINCOLN', '1LN': 'LINCOLN', // Lincoln
        '1ME': 'MERCURY', // Mercury
        '1G1': 'CHEVROLET', '1GC': 'CHEVROLET', '1GN': 'CHEVROLET', '1GT': 'GMC', '1GY': 'CADILLAC', // GM
        '2G1': 'CHEVROLET', '2GC': 'CHEVROLET', '2GN': 'CHEVROLET', // GM Canada
        '3G1': 'CHEVROLET', '3GC': 'CHEVROLET', '3GN': 'CHEVROLET', // GM Mexico
        'YS3': 'SAAB', // Saab (formerly GM)
        '1HG': 'HONDA', '1HF': 'HONDA', 'JH2': 'HONDA', 'JH4': 'ACURA', // Honda/Acura
        'KMH': 'HYUNDAI', 'KMC': 'HYUNDAI', 'KNA': 'KIA', 'KND': 'KIA', // Hyundai/Kia
        '5NM': 'HYUNDAI', '5NP': 'HYUNDAI', // Hyundai US
        'U5Y': 'KIA', // Kia US
        'MAL': 'HYUNDAI', // Hyundai (Genesis often under Hyundai WMI)
        'JN1': 'NISSAN', 'JN6': 'NISS
