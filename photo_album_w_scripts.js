// Global variables
var currentImageIndex = 1; // Tracks the currently displayed main image number
var currentStockNumber = ''; // Stores the 8-digit stock number
const MAX_THUMBNAILS = 8; // Number of thumbnails to display
const CARMAX_BASE_IMAGE_URL = 'https://img2.carmax.com/img/vehicles/';
const CARMAX_FALLBACK_URL_SNIPPET = '/fallback.jpg'; // CarMax's generic "no image" placeholder
const PLACEHOLDER_MAIN_IMAGE = 'https://placehold.co/800x600/cccccc/000000?text=Image+Not+Available';
const PLACEHOLDER_THUMBNAIL = 'https://placehold.co/100x75/eeeeee/aaaaaa?text=N/A';
const INITIAL_PLACEHOLDER_IMAGE = 'https://placehold.co/800x600/cccccc/000000?text=Enter+Stock+%23'; // New: For initial load

// --- Helper Functions ---

/**
 * Toggles the visibility of the Bootstrap spinner modal.
 * @param {boolean} show - True to show the spinner, false to hide.
 */
function toggleSpinner(show) {
    if (show) {
        // Ensure modal is instantiated if not already
        if (!($('#spinnerModal').data('bs.modal'))) {
            new bootstrap.Modal(document.getElementById('spinnerModal'));
        }
        $('#spinnerModal').modal('show');
    } else {
        // Use a small delay to ensure modal has time to show/hide smoothly
        setTimeout(function() { $('#spinnerModal').modal('hide'); }, 100);
    }
}

/**
 * Updates the main display image and triggers thumbnail regeneration.
 * @param {number} imageIndex - The index of the image to display (e.g., 1, 2, 3...).
 */
function displayImage(imageIndex) {
    // If no stock number is set, display a default state
    if (!currentStockNumber) {
        $('#instructions').show().html('<p><strong>Enter Stock #</strong></p>');
        $('#dispframe').attr('src', INITIAL_PLACEHOLDER_IMAGE).attr('alt', 'Enter Stock Number'); // Use the new initial placeholder
        $('#thumbnail-container').empty(); // Clear thumbnails
        $('#kmxlink').attr('href', '#');
        return;
    }

    currentImageIndex = Math.max(1, imageIndex); // Ensure index is at least 1

    toggleSpinner(true); // Show spinner while loading

    const mainImageElement = document.getElementById('dispframe');
    const zoomedImageElement = document.getElementById('zoomedImage'); // Get the zoomed image element

    const newImageUrl = `${CARMAX_BASE_IMAGE_URL}${currentStockNumber}/${currentImageIndex}.jpg`;

    // Clear previous errors/onload to prevent multiple calls
    mainImageElement.onerror = null;
    mainImageElement.onload = null;
    zoomedImageElement.onerror = null;
    zoomedImageElement.onload = null;

    // Set a temporary blank source to trigger reload in some browsers
    mainImageElement.src = '';
    zoomedImageElement.src = ''; // Clear zoomed image as well

    mainImageElement.src = newImageUrl; // Set the new image URL for main display
    mainImageElement.alt = `Vehicle Image ${currentImageIndex} for Stock #${currentStockNumber}`;

    // Load the same image into the zoomed modal as well
    zoomedImageElement.src = newImageUrl;
    zoomedImageElement.alt = `Zoomed Vehicle Image ${currentImageIndex} for Stock #${currentStockNumber}`;


    // Handle main image loading success
    mainImageElement.onload = function() {
        toggleSpinner(false); // Hide spinner on load

        // CarMax often returns a tiny 1x1 or 1x11 fallback image for missing photos.
        // We can check its natural dimensions to detect this.
        if (this.naturalWidth <= 11 && this.naturalHeight <= 11) {
            console.log(`Main image ${currentImageIndex} for ${currentStockNumber} is a tiny fallback/missing.`);
            this.src = PLACEHOLDER_MAIN_IMAGE;
            this.classList.add('no-image-available');
            zoomedImageElement.src = PLACEHOLDER_MAIN_IMAGE; // Update zoomed image to placeholder too
            zoomedImageElement.classList.add('no-image-available');
        } else {
            this.classList.remove('no-image-available');
            zoomedImageElement.classList.remove('no-image-available');
        }
        updateThumbnails(); // Always update thumbnails after main image loads
    };

    // Handle main image loading error (e.g., network error, 404)
    mainImageElement.onerror = function() {
        console.error(`Error loading main image: ${newImageUrl}. Setting to fallback placeholder.`);
        this.src = 'https://placehold.co/800x600/cccccc/000000?text=Image+Load+Error'; // Local placeholder for general errors
        this.classList.add('no-image-available');
        zoomedImageElement.src = 'https://placehold.co/800x600/cccccc/000000?text=Image+Load+Error'; // Update zoomed image to error placeholder
        zoomedImageElement.classList.add('no-image-available');
        toggleSpinner(false);
    };

    // Update CarMax page link
    $('#kmxlink').attr('href', `https://www.carmax.com/car/${currentStockNumber}`);
    $('#instructions').hide(); // Hide instructions once search starts
}

/**
 * Generates and updates the thumbnail strip.
 */
function updateThumbnails() {
    const thumbnailContainer = $('#thumbnail-container');
    thumbnailContainer.empty(); // Clear existing thumbnails

    // Determine the range of thumbnails to show
    // Try to center the current image if possible, or start from 1
    let startThumbIndex = Math.max(1, currentImageIndex - Math.floor(MAX_THUMBNAILS / 2));
    let endThumbIndex = startThumbIndex + MAX_THUMBNAILS;

    for (let i = startThumbIndex; i < endThumbIndex; i++) {
        const thumbNum = i;
        const thumbnailUrl = `${CARMAX_BASE_IMAGE_URL}${currentStockNumber}/${thumbNum}.jpg?width=100&height=75&fm=webp`; // Request smaller, webp for thumbnails
        // Changed column classes to better fit 8 thumbnails in a row on larger screens, or wrap gracefully
        const thumbDivResponsive = $(`<div class="col-3 col-sm-3 col-md-3 mb-2 d-flex justify-content-center align-items-center"></div>`); // col-md-3 will display 4 per row on MD+ screens

        const thumbImg = $(`<img class="img-fluid rounded thumbnail-img" src="${thumbnailUrl}" alt="Thumbnail ${thumbNum} for Stock #${currentStockNumber}" data-image-index="${thumbNum}">`);

        // Highlight active thumbnail
        if (thumbNum === currentImageIndex) {
            thumbImg.addClass('active-thumbnail');
        }

        // Error handling for thumbnails
        thumbImg.onerror = function() {
            // Replace with local placeholder if image fails to load or is CarMax's tiny fallback
            this.src = PLACEHOLDER_THUMBNAIL;
            this.classList.add('no-image-available');
        };

        thumbImg.onload = function() {
            // Check for CarMax's specific tiny fallback images
            if (this.naturalWidth <= 11 && this.naturalHeight <= 11) {
                this.src = PLACEHOLDER_THUMBNAIL;
                this.classList.add('no-image-available');
            } else {
                this.classList.remove('no-image-available');
            }
        };

        // Click handler for thumbnails to set main image
        thumbImg.on('click', function() {
            if (!$(this).hasClass('no-image-available')) { // Only click if not a "no image" placeholder
                 const clickedIndex = parseInt($(this).data('image-index'));
                 displayImage(clickedIndex);
            }
        });

        thumbDivResponsive.append(thumbImg);
        thumbnailContainer.append(thumbDivResponsive); // Append the responsive div
    }
}

// --- Navigation Functions ---

function prvs() {
    displayImage(currentImageIndex - 1);
}

function nxt() {
    displayImage(currentImageIndex + 1);
}

// --- Search Handlers ---

document.getElementById("btn_submit").onclick = function () {
    const vinBar = document.getElementById("VINbar");
    const inputStockNum = vinBar.value.trim();

    if (inputStockNum.length === 8) {
        currentStockNumber = inputStockNum;
        currentImageIndex = 1; // Always start with the first image for a new stock number
        displayImage(currentImageIndex);
    } else {
        $('#instructions').show().html(`<strong>Invalid Stock Number:</strong> Must be 8 digits. You entered ${inputStockNum.length} digits.`);
        $('#dispframe').attr('src', PLACEHOLDER_MAIN_IMAGE).attr('alt', 'Invalid Stock Number');
        $('#thumbnail-container').empty();
        $('#kmxlink').attr('href', '#');
        currentStockNumber = ''; // Clear stock number on invalid input
    }
};

document.getElementById("btn_submit2").onclick = function () {
    let linkBarValue = document.getElementById("LINKbar").value.trim();

    if (linkBarValue) {
        // Regex to extract 8-digit stock number and optional image index from CarMax URLs
        // Updated regex to more robustly capture stock number and image index
        const carmaxUrlRegex = /(?:vehicles|img)\/(\d{8})(?:\/(\d+))?(?:\.jpg|\.webp|\?|$)/i;
        const match = linkBarValue.match(carmaxUrlRegex);

        if (match && match[1]) { // match[1] is the 8-digit stock number
            currentStockNumber = match[1];
            currentImageIndex = parseInt(match[2]) || 1; // match[2] is the image index, default to 1

            document.getElementById("VINbar").value = currentStockNumber; // Populate VIN bar
            displayImage(currentImageIndex);
        } else {
            $('#instructions').show().html(`<strong>Invalid Image Link:</strong> Please paste a valid CarMax image URL. Example: <br><code>https://img2.carmax.com/img/vehicles/12345678/1.jpg</code>`);
            $('#dispframe').attr('src', PLACEHOLDER_MAIN_IMAGE).attr('alt', 'Invalid Link');
            $('#thumbnail-container').empty();
            $('#kmxlink').attr('href', '#');
            currentStockNumber = ''; // Clear stock number on invalid link
        }
    } else {
        $('#instructions').show().html(`<strong>Please paste a CarMax image link.</strong>`);
    }
};

// --- Event Listeners for Enter Key ---

var inputFields = ["VINbar", "LINKbar"];
inputFields.forEach(function(fieldId) {
    var input = document.getElementById(fieldId);
    input.addEventListener("keyup", function(event) {
        if (event.key === "Enter") { // Use event.key for modern browsers
            event.preventDefault(); // Prevent default form submission
            document.getElementById(fieldId === "VINbar" ? "btn_submit" : "btn_submit2").click();
        }
    });
});

// --- Initial Page Load ---
$(document).ready(function() {
    displayImage(currentImageIndex); // Show initial state
});

// Event listener for the main display image to open the zoom modal
$('#dispframe').on('click', function() {
    // Only open the modal if a valid image is displayed (not a placeholder)
    if (!$(this).hasClass('no-image-available') && currentStockNumber) {
        const zoomedImage = document.getElementById('zoomedImage');
        zoomedImage.src = this.src; // Set the source of the modal image to the current main image
        zoomedImage.alt = this.alt; // Copy alt text for accessibility
        $(zoomedImage).removeClass('no-image-available'); // Ensure no "no-image" class on zoomed image

        // Ensure modal is instantiated if not already
        if (!($('#imageZoomModal').data('bs.modal'))) {
            new bootstrap.Modal(document.getElementById('imageZoomModal'));
        }
        $('#imageZoomModal').modal('show');
    }
});
