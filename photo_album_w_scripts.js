var currentImageIndex = 1;
var currentStockNumber = "";
let isLoading = false;

const MAX_IMAGE_INDEX = 40;
const MAX_THUMBNAILS = 8;
const CARMAX_BASE_IMAGE_URL = "https://img2.carmax.com/img/vehicles/";
const PLACEHOLDER_MAIN_IMAGE = "https://placehold.co/800x600/cccccc/000000?text=Image+Not+Available";
const PLACEHOLDER_THUMBNAIL = "https://placehold.co/100x75/eeeeee/aaaaaa?text=N/A";
const INITIAL_PLACEHOLDER_IMAGE = "https://placehold.co/800x600/cccccc/000000?text=Enter+Stock+%23";

// Show or hide the loading spinner modal
function toggleSpinner(show) {
    if (show) {
        $("#spinnerModal").data("bs.modal") || new bootstrap.Modal(document.getElementById("spinnerModal"));
        $("#spinnerModal").modal("show");
    } else {
        setTimeout(() => {
            $("#spinnerModal").modal("hide");
        }, 100);
    }
}

// Display the main image and zoomed image, handle loading states and errors

function displayImage(requestedIndex) {
    if (isLoading) return;
    isLoading = true;

    const mainImage = document.getElementById("dispframe");
    const zoomedImage = document.getElementById("zoomedImage");

    mainImage.src = PLACEHOLDER_MAIN_IMAGE;
    zoomedImage.src = PLACEHOLDER_MAIN_IMAGE;
    mainImage.alt = "Loading...";
    zoomedImage.alt = "Loading...";
    toggleSpinner(true);

    currentImageIndex = Math.max(1, Math.min(requestedIndex, MAX_IMAGE_INDEX));
    const imageUrl = `${CARMAX_BASE_IMAGE_URL}${currentStockNumber}/${currentImageIndex}.jpg`;

    const timeout = setTimeout(() => {
        fallbackImage("Image took too long to load or is missing.");
    }, 7000);

    let loadHandled = false;

    function fallbackImage(message) {
        mainImage.src = PLACEHOLDER_MAIN_IMAGE;
        zoomedImage.src = PLACEHOLDER_MAIN_IMAGE;
        mainImage.classList.add("no-image-available");
        zoomedImage.classList.add("no-image-available");
        $("#instructions").show().html(`<p><strong>${message}</strong></p>`);
        toggleSpinner(false);
        isLoading = false;
    }

    mainImage.onload = function () {
        if (loadHandled) return;
        clearTimeout(timeout);
        loadHandled = true;
        isLoading = false;
        mainImage.style.opacity = 1;
        toggleSpinner(false);
        $("#instructions").hide();

        if (this.naturalWidth <= 11 && this.naturalHeight <= 11) {
            fallbackImage(`No more images available for Stock #${currentStockNumber}`);
        } else {
            mainImage.classList.remove("no-image-available");
            zoomedImage.classList.remove("no-image-available");
            updateThumbnails();  // Now this works, since it's declared outside
        }
    };

    mainImage.onerror = function () {
        if (loadHandled) return;
        clearTimeout(timeout);
        loadHandled = true;
        fallbackImage("Failed to load image.");
    };

    mainImage.src = imageUrl;
    zoomedImage.src = imageUrl;
    mainImage.alt = `Vehicle Image ${currentImageIndex} for Stock #${currentStockNumber}`;
    zoomedImage.alt = `Zoomed Vehicle Image ${currentImageIndex} for Stock #${currentStockNumber}`;
    $("#kmxlink").attr("href", `https://www.carmax.com/car/${currentStockNumber}`);
}

// Update thumbnail images
function updateThumbnails() {
    let startIndex = Math.max(1, currentImageIndex - 3);

    for (let i = 0; i < MAX_THUMBNAILS; i++) {
        const imageIndex = Math.min(MAX_IMAGE_INDEX, startIndex + i);
        const thumb = $(`#thumb${i + 1}`);

        if (thumb.length === 0) continue;

        const url = `${CARMAX_BASE_IMAGE_URL}${currentStockNumber}/${imageIndex}.jpg?width=100&height=75&cb=${Date.now()}`;
        const noStock = !currentStockNumber;

        thumb.attr("src", noStock ? PLACEHOLDER_THUMBNAIL : url);
        thumb.attr("alt", `Thumbnail ${imageIndex}`);
        thumb.data("image-index", imageIndex);

        if (currentStockNumber && imageIndex === currentImageIndex) {
            thumb.addClass("active-thumbnail");
        } else {
            thumb.removeClass("active-thumbnail");
        }

        thumb[0].onload = function () {
            if (this.naturalWidth <= 11 && this.naturalHeight <= 11) {
                this.src = PLACEHOLDER_THUMBNAIL;
                this.classList.add("no-image-available");
            } else {
                this.classList.remove("no-image-available");
            }
        };

        thumb[0].onerror = function () {
            this.src = PLACEHOLDER_THUMBNAIL;
            this.classList.add("no-image-available");
        };

        if (noStock) {
            thumb.addClass("no-image-available");
        } else {
            thumb.removeClass("no-image-available");
        }
    }
}

// Previous image
function prvs() {
    if (currentStockNumber && currentImageIndex > 1) {
        displayImage(currentImageIndex - 1);
    }
}

// Next image
function nxt() {
    if (currentStockNumber && currentImageIndex < MAX_IMAGE_INDEX) {
        displayImage(currentImageIndex + 1);
    } else {
        $("#instructions").show().html(`<p><strong>No more images. Max is ${MAX_IMAGE_INDEX}.</strong></p>`);
    }
}

// Submit by Stock Number
document.getElementById("btn_submit").onclick = function () {
    const val = document.getElementById("VINbar").value.trim();
    if (/^\d{8}$/.test(val)) {
        currentStockNumber = val;
        currentImageIndex = 1;
        displayImage(currentImageIndex);
    } else {
        $("#instructions").show().html("<strong>Invalid Stock Number:</strong> Must be 8 digits.");
        $("#dispframe").attr("src", INITIAL_PLACEHOLDER_IMAGE).attr("alt", "Invalid Stock Number");
        currentStockNumber = "";
        updateThumbnails();
        $("#kmxlink").attr("href", "#");
    }
};

// Submit by CarMax URL
document.getElementById("btn_submit2").onclick = function () {
    const val = document.getElementById("LINKbar").value.trim();
    const match = val.match(/(?:vehicles|img)\/(\d{8})(?:\/(\d+))?/i);
    if (match && match[1]) {
        currentStockNumber = match[1];
        currentImageIndex = Math.min(parseInt(match[2]) || 1, MAX_IMAGE_INDEX);
        document.getElementById("VINbar").value = currentStockNumber;
        displayImage(currentImageIndex);
    } else {
        $("#instructions").show().html("<strong>Invalid URL. Paste a valid CarMax image link.</strong>");
        $("#dispframe").attr("src", INITIAL_PLACEHOLDER_IMAGE).attr("alt", "Invalid Link");
        currentStockNumber = "";
        updateThumbnails();
        $("#kmxlink").attr("href", "#");
    }
};

// Handle Enter key for both fields
["VINbar", "LINKbar"].forEach((id) => {
    document.getElementById(id).addEventListener("keyup", function (event) {
        if (event.key === "Enter") {
            document.getElementById(id === "VINbar" ? "btn_submit" : "btn_submit2").click();
        }
    });
});

// Initialize
$(document).ready(function () {
    displayImage(currentImageIndex);
});

// Zoom modal
$("#dispframe").on("click", function () {
    if (!$(this).hasClass("no-image-available") && currentStockNumber) {
        const zoomedImage = document.getElementById("zoomedImage");
        zoomedImage.src = this.src;
        zoomedImage.alt = this.alt;
        $(zoomedImage).removeClass("no-image-available");
        $("#imageZoomModal").data("bs.modal") || new bootstrap.Modal(document.getElementById("imageZoomModal"));
        $("#imageZoomModal").modal("show");
    }
});
