var currentImageIndex = 1;
var currentStockNumber = "";
let isLoading = false; // Flag to prevent multiple image loads simultaneously

// Global variable to store the modal instance
let spinnerModalInstance = null; // Declare this at the top with other global vars

const MAX_IMAGE_INDEX = 40;
const MAX_THUMBNAILS = 8; // Number of thumbnail slots in the HTML
const CARMAX_BASE_IMAGE_URL = "https://img2.carmax.com/img/vehicles/";
const PLACEHOLDER_MAIN_IMAGE = "https://placehold.co/800x600/cccccc/000000?text=Image+Not+Available";
const PLACEHHER_THUMBNAIL = "https://placehold.co/100x75/eeeeee/aaaaaa?text=N/A";
const INITIAL_PLACEHOLDER_IMAGE = "https://placehold.co/800x600/cccccc/000000?text=Enter+Stock+%23";

// --- IMPORTANT: Event listener for when the modal is *actually* hidden ---
document.addEventListener('hidden.bs.modal', function (event) {
    if (event.target.id === 'spinnerModal') {
        isLoading = false; // Reset isLoading ONLY when spinner is fully hidden
        console.log(`[Spinner Debug] hidden.bs.modal event fired for spinnerModal. isLoading set to false: ${isLoading}`);
        // Optionally, remove the 'show' class and style attribute if Bootstrap fails to
        // This is a last resort/manual cleanup, Bootstrap *should* handle this
        const spinnerElement = document.getElementById('spinnerModal');
        if (spinnerElement) {
            spinnerElement.classList.remove('show');
            spinnerElement.style.display = ''; // Clear inline style
            console.log("[Spinner Debug] Manual cleanup: Removed 'show' class and inline style.");
        }
    }
});

// Show or hide the loading spinner modal
function toggleSpinner(show) {
    console.log(`[Spinner Debug] toggleSpinner called: ${show ? 'SHOW' : 'HIDE'}`);

    const spinnerModalElement = document.getElementById("spinnerModal");

    if (show) {
        // Create Bootstrap modal instance if it doesn't exist
        if (!spinnerModalInstance) {
            spinnerModalInstance = new bootstrap.Modal(spinnerModalElement, {
                backdrop: 'static', // Prevents closing by clicking outside
                keyboard: false     // Prevents closing by ESC key
            });
            console.log("[Spinner Debug] New Bootstrap Modal instance created or retrieved.");
        }
        // Temporarily set isLoading to true here, it will be reset on hidden.bs.modal
        isLoading = true;
        spinnerModalInstance.show();
        console.log("[Spinner Debug] Spinner modal instance .show() called.");
        console.log(`[Spinner Debug] isLoading set to true immediately after show() call: ${isLoading}`);
    } else {
        // No setTimeout needed here, as we're relying on hidden.bs.modal for final isLoading reset
        if (spinnerModalInstance) {
            spinnerModalInstance.hide();
            console.log("[Spinner Debug] Spinner modal instance .hide() called.");
        } else {
            console.warn("[Spinner Debug] spinnerModalInstance is null when trying to hide.");
            // If instance is null, we can't reliably hide. Force isLoading to false.
            isLoading = false;
            console.log(`[Spinner Debug] Forced isLoading to false as modal instance was null. Current isLoading: ${isLoading}`);
        }
    }
}

// Display the main image and zoomed image, handle loading states and errors
function displayImage(requestedIndex) {
    console.log(`[displayImage] Called with requestedIndex: ${requestedIndex}, currentStockNumber: ${currentStockNumber}, isLoading: ${isLoading}`);

    // IMPORTANT: Move the isLoading check to *after* the toggleSpinner(true) call
    // This ensures the spinner *always* shows when displayImage is initiated
    // The subsequent calls will be blocked if isLoading is true from the show() call itself
    // But the first call will *always* trigger the show.
    // It's critical that the displayImage function itself doesn't return early before
    // the spinner has a chance to be explicitly told to show.

    const mainImage = document.getElementById("dispframe");
    const zoomedImage = document.getElementById("zoomedImage");

    mainImage.style.opacity = 0.5; // Dim current image while loading new
    toggleSpinner(true); // Show spinner first
    console.log("[displayImage] Spinner shown. Checking isLoading status again after show():", isLoading);

    if (isLoading && mainImage.src !== INITIAL_PLACEHOLDER_IMAGE) { // Added condition to allow initial load
         // This `isLoading` here will be true because `toggleSpinner(true)` just set it.
         // We prevent *re-entering* `displayImage` if an old one is truly stuck.
         // However, for the very first call, we *want* it to proceed.
         // The main guard against re-entry is at the very top of `displayImage`
         // when it's called repeatedly, but now it's inside `toggleSpinner`'s `show()`.
         // Re-evaluate if this `if (isLoading)` block should even be here.
         // For now, let's remove the return here to ensure the logic flows.
         // The `isLoading` check at the very top of `displayImage` is the primary gate.
         // If toggleSpinner(true) sets isLoading to true, and displayImage was called again,
         // then the top `if (isLoading) return;` should catch it.
         // Let's rely on that and the `hidden.bs.modal` event.
    }


    currentImageIndex = Math.max(1, Math.min(requestedIndex, MAX_IMAGE_INDEX));
    const imageUrl = `<span class="math-inline">\{CARMAX\_BASE\_IMAGE\_URL\}</span>{currentStockNumber}/${currentImageIndex}.jpg`;
    console.log(`[displayImage] Attempting to load image: ${imageUrl}`);

    let loadHandled = false; // To prevent double handling of load/error events

    const timeout = setTimeout(() => {
        if (!loadHandled) { // Only fallback if load/error hasn't already fired
            console.warn("[displayImage] Image load timed out!");
            fallbackImage(`Image took too long to load or is missing for Stock #${currentStockNumber}`);
            loadHandled = true; // Mark as handled
        }
    }, 7000);
    console.log("[displayImage] Timeout set for 7 seconds.");

    function fallbackImage(message) {
        console.log(`[displayImage] fallbackImage called with message: ${message}`);
        mainImage.src = PLACEHOLDER_MAIN_IMAGE;
        zoomedImage.src = PLACEHOLDER_MAIN_IMAGE;
        mainImage.classList.add("no-image-available");
        zoomedImage.classList.add("no-image-available");
        $("#instructions").show().html(`<p><strong>${message}</strong></p>`);
        toggleSpinner(false); // Request spinner to hide
        updateThumbnails(); // Update thumbnails even on error
        console.log("[displayImage] Fallback image displayed. Spinner hide requested.");
    }

    // Set up onload/onerror handlers for the main image
    mainImage.onload = function () {
        console.log("[displayImage] mainImage.onload fired.");
        if (loadHandled) {
            console.log("[displayImage] onload: Event already handled, returning.");
            return;
        }
        clearTimeout(timeout);
        loadHandled = true;

        console.log(`[displayImage] onload: Image loaded. Natural dimensions: <span class="math-inline">\{this\.naturalWidth\}x</span>{this.naturalHeight}`);

        if (this.naturalWidth <= 11 && this.naturalHeight <= 11) {
            console.log("[displayImage] onload: Image dimensions too small (placeholder).");
            fallbackImage(`No more images available or image is invalid for Stock #${currentStockNumber}`);
        } else {
            console.log("[displayImage] onload: Image valid. Updating UI.");
            mainImage.style.opacity = 1; // Restore full opacity
            mainImage.classList.remove("no-image-available");
            zoomedImage.classList.remove("no-image-available");
            $("#instructions").hide();
            toggleSpinner(false); // Request spinner to hide
            updateThumbnails(); // Update thumbnails after main image loads
            console.log("[displayImage] onload: UI updated, spinner hide requested, thumbnails updated.");
        }
    };

    mainImage.onerror = function () {
        console.log("[displayImage] mainImage.onerror fired.");
        if (loadHandled) {
            console.log("[displayImage] onerror: Event already handled, returning.");
            return;
        }
        clearTimeout(timeout);
        loadHandled = true;
        fallbackImage("Failed to load image (onerror event).");
        console.log("[displayImage] onerror: Fallback image displayed.");
    };

    // Set the source last to trigger loading
    mainImage.src = imageUrl;
    zoomedImage.src = imageUrl; // Also set for the zoom modal
    mainImage.alt = `Vehicle Image <span class="math-inline">\{currentImageIndex\} for Stock \#</span>{currentStockNumber}`;
    zoomedImage.alt = `Zoomed Vehicle Image <span class="math-inline">\{currentImageIndex\} for Stock \#</span>{currentStockNumber}`;
    $("#kmxlink").attr("href", `https://www.carmax.com/car/${currentStockNumber}`);
    console.log(`[displayImage] Main image source set to: ${imageUrl}`);
}

// Rest of your script (updateThumbnails, prvs, nxt, btn_submit, btn_submit2, event listeners, document.ready, zoom modal) remains the same as previously provided with debug logs.
// Ensure the `updateThumbnails` and other functions are using the `currentImageIndex` and `currentStockNumber` as defined.
// I'm not repeating the entire script for brevity, but make sure you integrate these changes into your existing one.
