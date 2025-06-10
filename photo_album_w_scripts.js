// Global variables
var currentImageIndex = 1;
var currentStockNumber = '';
const MAX_THUMBNAILS = 8;
const CARMAX_BASE_IMAGE_URL = 'https://img2.carmax.com/img/vehicles/';
const PLACEHOLDER_MAIN_IMAGE = 'https://placehold.co/800x600/cccccc/000000?text=Image+Not+Available';
const PLACEHOLDER_THUMBNAIL = 'https://placehold.co/100x75/eeeeee/aaaaaa?text=N/A';
const INITIAL_PLACEHOLDER_IMAGE = 'https://placehold.co/800x600/cccccc/000000?text=Enter+Stock+%23';

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

    const newImageUrl = `${CARMAX_BASE_IMAGE_URL}${currentStockNumber}/${currentImageIndex}.jpg`;

    mainImageElement.onerror = null;
    mainImageElement.onload = null;
    mainImageElement.src = newImageUrl;
    mainImageElement.alt = `Vehicle Image ${currentImageIndex} for Stock #${currentStockNumber}`;
    zoomedImageElement.src = newImageUrl;
    zoomedImageElement.alt = `Zoomed Vehicle Image ${currentImageIndex} for Stock #${currentStockNumber}`;

    mainImageElement.onload = function () {
        mainImageElement.style.opacity = 1;

        if (this.naturalWidth <= 11 && this.naturalHeight <= 11) {
            console.log(`Main image ${currentImageIndex} for ${currentStockNumber} is a fallback/missing.`);
            currentImageIndex = Math.max(1, currentImageIndex - 1);

            this.src = PLACEHOLDER_MAIN_IMAGE;
            this.classList.add('no-image-available');
            zoomedImageElement.src = PLACEHOLDER_MAIN_IMAGE;
            zoomedImageElement.classList.add('no-image-available');

            $('#instructions').show().html(`<p><strong>No more images available for Stock #${currentStockNumber}</strong></p>`);
            toggleSpinner(false); // Ensure spinner is hidden
            return;
        }

        this.classList.remove('no-image-available');
        zoomedImageElement.classList.remove('no-image-available');
        toggleSpinner(false);
        updateThumbnails();
    };

    mainImageElement.onerror = function () {
        mainImageElement.style.opacity = 1;
        console.error(`Error loading main image: ${newImageUrl}. Setting to fallback placeholder.`);
        this.src = 'https://placehold.co/800x600/cccccc/000000?text=Image+Load+Error';
        this.classList.add('no-image-available');
        zoomedImageElement.src = 'https://placehold.co/800x600/cccccc/000000?text=Image+Load+Error';
        zoomedImageElement.classList.add('no-image-available');
        toggleSpinner(false);
    };

    $('#kmxlink').attr('href', `https://www.carmax.com/car/${currentStockNumber}`);
    $('#instructions').hide();
}

function updateThumbnails() {
    let startThumbIndex = Math.max(1, currentImageIndex - Math.floor(MAX_THUMBNAILS / 2));
    startThumbIndex = Math.max(1, startThumbIndex);

    for (let i = 0; i < MAX_THUMBNAILS; i++) {
        const thumbNum = startThumbIndex + i;
        const thumbImg = $(`#thumb${i + 1}`);

        if (thumbImg.length === 0) continue;

        let thumbnailUrl = `${CARMAX_BASE_IMAGE_URL}${currentStockNumber}/${thumbNum}.jpg?width=100&height=75&fm=webp`;
        let isPlaceholder = !currentStockNumber || thumbNum < 1;

        if (isPlaceholder) {
            thumbnailUrl = PLACEHOLDER_THUMBNAIL;
        }

        thumbImg[0].onerror = null;
        thumbImg[0].onload = null;
        thumbImg.attr('src', thumbnailUrl).attr('alt', `Thumbnail ${thumbNum}`).data('image-index', thumbNum);

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

document.getElementById("btn_submit").onclick = function () {
    const vinBar = document.getElementById("VINbar");
    const inputStockNum = vinBar.value.trim();

    if (inputStockNum.length === 8) {
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

document.getElementById("btn_submit2").onclick = function () {
    let linkBarValue = document.getElementById("LINKbar").value.trim();
    const carmaxUrlRegex = /(?:vehicles|img)\/(\d{8})(?:\/(\d+))?(?:\.jpg|\.webp|\?|$)/i;
    const match = linkBarValue.match(carmaxUrlRegex);

    if (match && match[1]) {
        currentStockNumber = match[1];
        currentImageIndex = parseInt(match[2]) || 1;
        document.getElementById("VINbar").value = currentStockNumber;
        displayImage(currentImageIndex);
    } else {
        $('#instructions').show().html(`<strong>Invalid Link:</strong> Must be CarMax image URL.`);
        $('#dispframe').attr('src', INITIAL_PLACEHOLDER_IMAGE).attr('alt', 'Invalid Link');
        currentStockNumber = '';
        updateThumbnails();
        $('#kmxlink').attr('href', '#');
    }
};

["VINbar", "LINKbar"].forEach(function(fieldId) {
    document.getElementById(fieldId).addEventListener("keyup", function(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            document.getElementById(fieldId === "VINbar" ? "btn_submit" : "btn_submit2").click();
        }
    });
});

$(document).ready(function () {
    if (!currentStockNumber) {
        document.getElementById('dispframe').src = INITIAL_PLACEHOLDER_IMAGE;
        document.getElementById('zoomedImage').src = INITIAL_PLACEHOLDER_IMAGE;
        $('#instructions').show().html('<p><strong>Enter Stock #</strong></p>');
        updateThumbnails();
    }
});

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
