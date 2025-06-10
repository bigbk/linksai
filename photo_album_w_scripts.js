// Global variables
var currentImageIndex = 1;
var currentStockNumber = '';
const MAX_THUMBNAILS = 8;
const CARMAX_BASE_IMAGE_URL = 'https://img2.carmax.com/img/vehicles/';
const PLACEHOLDER_MAIN_IMAGE = 'https://placehold.co/800x600/cccccc/000000?text=Image+Not+Available';
const PLACEHOLDER_THUMBNAIL = 'https://placehold.co/100x75/eeeeee/aaaaaa?text=N/A';
const INITIAL_PLACEHOLDER_IMAGE = 'https://placehold.co/800x600/cccccc/000000?text=Enter+Stock+%23';

// Spinner
function toggleSpinner(show) {
    if (show) {
        if (!($('#spinnerModal').data('bs.modal'))) {
            new bootstrap.Modal(document.getElementById('spinnerModal'));
        }
        $('#spinnerModal').modal('show');
    } else {
        setTimeout(() => { $('#spinnerModal').modal('hide'); }, 100);
    }
}

// Display main image
function displayImage(imageIndex) {
    const mainImageElement = document.getElementById('dispframe');
    const zoomedImageElement = document.getElementById('zoomedImage');

    if (!currentStockNumber) {
        $('#instructions').show().html('<p><strong>Enter Stock #</strong></p>');
        mainImageElement.src = INITIAL_PLACEHOLDER_IMAGE;
        mainImageElement.alt = 'Enter Stock Number';
        $(mainImageElement).removeClass('no-image-available');
        zoomedImageElement.src = INITIAL_PLACEHOLDER_IMAGE;
        $(zoomedImageElement).removeClass('no-image-available');
        updateThumbnails();
        $('#kmxlink').attr('href', '#');
        return;
    }

    currentImageIndex = Math.max(1, imageIndex);
    mainImageElement.style.opacity = 0;
    toggleSpinner(true);
    $('#instructions').show().html('<p>Loading image...</p>');

    const timestamp = Date.now(); // for cache busting
    const newImageUrl = `${CARMAX_BASE_IMAGE_URL}${currentStockNumber}/${currentImageIndex}.jpg?cb=${timestamp}`;

    mainImageElement.onerror = null;
    mainImageElement.onload = null;

    mainImageElement.src = newImageUrl;
    mainImageElement.alt = `Vehicle Image ${currentImageIndex} for Stock #${currentStockNumber}`;
    zoomedImageElement.src = newImageUrl;
    zoomedImageElement.alt = `Zoomed Vehicle Image ${currentImageIndex} for Stock #${currentStockNumber}`;

    const loadTimeout = setTimeout(() => {
        console.warn('Image load timed out.');
        mainImageElement.src = PLACEHOLDER_MAIN_IMAGE;
        mainImageElement.classList.add('no-image-available');
        zoomedImageElement.src = PLACEHOLDER_MAIN_IMAGE;
        zoomedImageElement.classList.add('no-image-available');
        $('#instructions').show().html(`<p><strong>Image took too long to load or is missing.</strong></p>`);
        toggleSpinner(false);
    }, 7000); // 7 second timeout

    mainImageElement.onload = function () {
        clearTimeout(loadTimeout);
        mainImageElement.style.opacity = 1;
        toggleSpinner(false);
        $('#instructions').hide();

        if (this.naturalWidth <= 11 && this.naturalHeight <= 11) {
            console.log(`Fallback image detected.`);
            currentImageIndex = Math.max(1, currentImageIndex - 1);
            this.src = PLACEHOLDER_MAIN_IMAGE;
            this.classList.add('no-image-available');
            zoomedImageElement.src = PLACEHOLDER_MAIN_IMAGE;
            zoomedImageElement.classList.add('no-image-available');
            $('#instructions').show().html(`<p><strong>No more images available for Stock #${currentStockNumber}</strong></p>`);
            return;
        }

        this.classList.remove('no-image-available');
        zoomedImageElement.classList.remove('no-image-available');
        updateThumbnails();
    };

    mainImageElement.onerror = function () {
        clearTimeout(loadTimeout);
        mainImageElement.style.opacity = 1;
        this.src = 'https://placehold.co/800x600/cccccc/000000?text=Image+Load+Error';
        this.classList.add('no-image-available');
        zoomedImageElement.src = 'https://placehold.co/800x600/cccccc/000000?text=Image+Load+Error';
        zoomedImageElement.classList.add('no-image-available');
        toggleSpinner(false);
        $('#instructions').show().html(`<p><strong>Failed to load image.</strong></p>`);
    };

    $('#kmxlink').attr('href', `https://www.carmax.com/car/${currentStockNumber}`);
}

// Update thumbnails
function updateThumbnails() {
    let startThumbIndex = Math.max(1, currentImageIndex - 3);

    for (let i = 0; i < MAX_THUMBNAILS; i++) {
        const thumbNum = startThumbIndex + i;
        const thumbImg = $(`#thumb${i + 1}`);
        if (thumbImg.length === 0) continue;

        const thumbUrl = `${CARMAX_BASE_IMAGE_URL}${currentStockNumber}/${thumbNum}.jpg?width=100&height=75&cb=${Date.now()}`;
        const isPlaceholder = !currentStockNumber;

        thumbImg[0].onerror = null;
        thumbImg[0].onload = null;

        thumbImg.attr('src', isPlaceholder ? PLACEHOLDER_THUMBNAIL : thumbUrl);
        thumbImg.attr('alt', `Thumbnail ${thumbNum}`);
        thumbImg.data('image-index', thumbNum);

        if (currentStockNumber && thumbNum === currentImageIndex) {
            thumbImg.addClass('active-thumbnail');
        } else {
            thumbImg.removeClass('active-thumbnail');
        }

        thumbImg[0].onload = function () {
            if (this.naturalWidth <= 11 && this.naturalHeight <= 11) {
                this.src = PLACEHOLDER_THUMBNAIL;
                this.classList.add('no-image-available');
            } else {
                this.classList.remove('no-image-available');
            }
        };

        thumbImg[0].onerror = function () {
            this.src = PLACEHOLDER_THUMBNAIL;
            this.classList.add('no-image-available');
        };

        if (isPlaceholder) {
            thumbImg.addClass('no-image-available');
        } else {
            thumbImg.removeClass('no-image-available');
        }
    }
}

// Navigation
function prvs() {
    if (currentStockNumber && currentImageIndex > 1) {
        displayImage(currentImageIndex - 1);
    }
}

function nxt() {
    if (currentStockNumber) {
        displayImage(currentImageIndex + 1);
    }
}

// VIN Submit
document.getElementById("btn_submit").onclick = function () {
    const vinBar = document.getElementById("VINbar");
    const inputStockNum = vinBar.value.trim();

    if (/^\d{8}$/.test(inputStockNum)) {
        currentStockNumber = inputStockNum;
        currentImageIndex = 1;
        displayImage(currentImageIndex);
    } else {
        $('#instructions').show().html(`<strong>Invalid Stock Number:</strong> Must be 8 digits.`);
        $('#dispframe').attr('src', INITIAL_PLACEHOLDER_IMAGE).attr('alt', 'Invalid Stock Number');
        currentStockNumber = '';
        updateThumbnails();
        $('#kmxlink').attr('href', '#');
    }
};

// Link Submit
document.getElementById("btn_submit2").onclick = function () {
    let linkVal = document.getElementById("LINKbar").value.trim();
    const match = linkVal.match(/(?:vehicles|img)\/(\d{8})(?:\/(\d+))?/i);
    if (match && match[1]) {
        currentStockNumber = match[1];
        currentImageIndex = parseInt(match[2]) || 1;
        document.getElementById("VINbar").value = currentStockNumber;
        displayImage(currentImageIndex);
    } else {
        $('#instructions').show().html(`<strong>Invalid URL. Paste a valid CarMax image link.</strong>`);
        $('#dispframe').attr('src', INITIAL_PLACEHOLDER_IMAGE).attr('alt', 'Invalid Link');
        currentStockNumber = '';
        updateThumbnails();
        $('#kmxlink').attr('href', '#');
    }
};

// Keyboard enter for inputs
["VINbar", "LINKbar"].forEach(id => {
    document.getElementById(id).addEventListener("keyup", function (e) {
        if (e.key === "Enter") {
            document.getElementById(id === "VINbar" ? "btn_submit" : "btn_submit2").click();
        }
    });
});

// Initial load
$(document).ready(function () {
    displayImage(currentImageIndex);
});

// Zoom modal click
$('#dispframe').on('click', function () {
    if (!$(this).hasClass('no-image-available') && currentStockNumber) {
        const zoomedImage = document.getElementById('zoomedImage');
        zoomedImage.src = this.src;
        zoomedImage.alt = this.alt;
        $(zoomedImage).removeClass('no-image-available');
        if (!($('#imageZoomModal').data('bs.modal'))) {
            new bootstrap.Modal(document.getElementById('imageZoomModal'));
        }
        $('#imageZoomModal').modal('show');
    }
});
