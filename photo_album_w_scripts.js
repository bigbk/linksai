// Global variables
var currentImageIndex = 1; // Tracks the currently displayed main image number
var currentStockNumber = ''; // Stores the 8-digit stock number
const MAX_THUMBNAILS = 8; // Number of thumbnails to display
const CARMAX_BASE_IMAGE_URL = 'https://img2.carmax.com/img/vehicles/';
const CARMAX_FALLBACK_URL_SNIPPET = '/fallback.jpg'; // CarMax's generic "no image" placeholder

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
        $('#instructions').show().html('<p><strong>Enter a Stock # (8 digits) or paste a CarMax image link.</strong></p>');
        $('#dispframe').attr('src', 'https://placehold.co/800x600/cccccc/000000?text=Enter+Stock+%23');
        $('#thumbnail-container').empty(); // Clear thumbnails
        $('#kmxlink').attr('href', '#');
        return;
    }

    currentImageIndex = Math.max(1, imageIndex); // Ensure index is at least 1

    toggleSpinner(true); // Show spinner while loading

    const mainImageElement = document.getElementById('dispframe');
    const newImageUrl = `${CARMAX_BASE_IMAGE_URL}${currentStockNumber}/${currentImageIndex}.jpg`;

    // Clear previous errors to allow new loads
    mainImageElement.onerror = null;
    mainImageElement.onload = null;

    // Set a temporary blank source to trigger reload in some browsers
    mainImageElement.src = '';
    mainImageElement.src = newImageUrl; // Set the new image URL

    // Handle image loading success
    mainImageElement.onload = function() {
        toggleSpinner(false); // Hide spinner on load

        // CarMax often returns a tiny 1x1 or 1x11 fallback image for missing photos.
        // We can check its natural dimensions to detect this.
        if (this.naturalWidth <= 11 && this.naturalHeight <= 11) {
            console.log(`Main image ${currentImageIndex} for ${currentStockNumber} is a tiny fallback/missing.`);
            this.src = 'https://placehold.co/800x600/cccccc/000000?text=Image+Not+Available'; // Replace with a local placeholder
            this.classList.add('no-image-available'); // Add class for styling if needed
        } else {
            this.classList.remove('no-image-available'); // Remove class if image is valid
        }
        updateThumbnails(); // Always update thumbnails after main image loads
    };

    // Handle image loading error (e.g., network error, 404)
    mainImageElement.onerror = function() {
        console.error(`Error loading main image: ${newImageUrl}. Setting to fallback placeholder.`);
        this.src = 'https://placehold.co/800x600/cccccc/000000?text=Image+Load+Error'; // Local placeholder for general errors
        this.classList.add('no-image-available');
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
        const thumbDiv = $(`<div class="col-3 col-sm-2 col-md-1 mb-2"></div>`); // Bootstrap grid for thumbnail sizing

        const thumbImg = $(`<img class="img-fluid rounded thumbnail-img" src="${thumbnailUrl}" alt="Thumbnail ${thumbNum}" data-image-index="${thumbNum}">`);

        // Highlight active thumbnail
        if (thumbNum === currentImageIndex) {
            thumbImg.addClass('active-thumbnail');
        }

        // Error handling for thumbnails
        thumbImg.onerror = function() {
            // Replace with local placeholder if image fails to load
            this.src = 'https://placehold.co/100x75/eeeeee/aaaaaa?text=N/A';
            this.classList.add('no-image-available');
        };

        thumbImg.onload = function() {
            // Check for CarMax's specific tiny fallback images
            if (this.naturalWidth <= 11 && this.naturalHeight <= 11) {
                this.src = 'https://placehold.co/100x75/eeeeee/aaaaaa?text=N/A';
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

        thumbDiv.append(thumbImg);
        thumbnailContainer.append(thumbDiv);
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
        $('#dispframe').attr('src', 'https://placehold.co/800x600/cccccc/000000?text=Enter+8-Digit+Stock+%23');
        $('#thumbnail-container').empty();
        $('#kmxlink').attr('href', '#');
        currentStockNumber = ''; // Clear stock number on invalid input
    }
};

document.getElementById("btn_submit2").onclick = function () {
    let linkBarValue = document.getElementById("LINKbar").value.trim();

    if (linkBarValue) {
        // Regex to extract 8-digit stock number and optional image index from CarMax URLs
        const carmaxUrlRegex = /vehicles\/(\d{8})\/(\d+)?(?:\.jpg|\.webp)?/i;
        const match = linkBarValue.match(carmaxUrlRegex);

        if (match && match[1]) { // match[1] is the 8-digit stock number
            currentStockNumber = match[1];
            currentImageIndex = parseInt(match[2]) || 1; // match[2] is the image index, default to 1

            document.getElementById("VINbar").value = currentStockNumber; // Populate VIN bar
            displayImage(currentImageIndex);
        } else {
            $('#instructions').show().html(`<strong>Invalid Image Link:</strong> Please paste a valid CarMax image URL. Example: <br><code>https://img2.carmax.com/img/vehicles/12345678/1.jpg</code>`);
            $('#dispframe').attr('src', 'https://placehold.co/800x600/cccccc/000000?text=Invalid+Link');
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
