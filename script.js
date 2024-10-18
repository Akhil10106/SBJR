// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAG3xjX_n_Bx0p8WOGYMqZz9wiL9yWSZSc",
    authDomain: "sbjr-agriculture-shop.firebaseapp.com",
    projectId: "sbjr-agriculture-shop",
    storageBucket: "sbjr-agriculture-shop.appspot.com",
    messagingSenderId: "364119868491",
    appId: "1:364119868491:web:bf66589b710e4f5d7f79ce",
    measurementId: "G-RSJHB63PX9"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get Firebase services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

let currentUser = null;
let cart = [];


function toggleAuthForm() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const authToggle = document.getElementById('auth-toggle');

    if (loginForm.style.display !== 'none') {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        forgotPasswordForm.style.display = 'none';
        authToggle.innerHTML = 'Already have an account? <a href="#" onclick="toggleAuthForm()">Login here</a>';
    } else {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        forgotPasswordForm.style.display = 'none';
        authToggle.innerHTML = 'New user? <a href="#" onclick="toggleAuthForm()">Register here</a>';
    }
}

// Add these new theme management functions before the DOMContentLoaded event
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

// Add this function to check if the user is an owner
function checkOwnerStatus(uid) {
    db.collection('users').doc(uid).get().then(doc => {
        if (doc.exists && doc.data().isOwner) {
            document.querySelector('.nav-link.owner-only').style.display = 'inline-block';
        } else {
            document.querySelector('.nav-link.owner-only').style.display = 'none';
        }
    }).catch(error => {
        console.error("Error checking owner status:", error);
    });
}

// Listen for auth state changes
auth.onAuthStateChanged(user => {
    console.log("Auth state changed", user);
    if (user) {
        console.log("User is signed in", user);
        currentUser = user;
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('home-container').style.display = 'block';
        checkAdminStatus(user.uid);
        checkOwnerStatus(user.uid); // Add this line
        showHome();
    } else {
        console.log("User is signed out");
        currentUser = null;
        document.getElementById('login-container').style.display = 'block';
        document.getElementById('home-container').style.display = 'none';
        document.querySelector('.admin-only').style.display = 'none';
    }
});

function checkAdminStatus(uid) {
    console.log("Checking admin status for", uid);
    db.collection('users').doc(uid).get().then(doc => {
        console.log("User document", doc.data());
        if (doc.exists && doc.data().isAdmin) {
            document.querySelector('.admin-only').style.display = 'inline-block';
        }
    }).catch(error => {
        console.error("Error checking admin status", error);
        showError('Error checking admin status: ' + error.message);
    });
}

function login() {
    console.log("Login function called");
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    console.log("Attempting login with email:", email);
    
    if (!email || !password) {
        showError('Please enter both email and password.');
        return;
    }
    
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            console.log("Login successful", userCredential.user);
            // Check if the user document exists in Firestore
            return db.collection('users').doc(userCredential.user.uid).get();
        })
        .then((doc) => {
            if (doc.exists) {
                showSuccess(`Welcome back, ${doc.data().name || doc.data().email}!`);
                currentUser = auth.currentUser;
                showHome();
            } else {
                // User document doesn't exist, sign out and show error
                auth.signOut();
                throw new Error('User account has been deleted. Please contact support if you believe this is an error.');
            }
        })
        .catch((error) => {
            console.error("Login error", error);
            switch (error.code) {
                case 'auth/invalid-login-credentials':
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                    showError('Invalid email or password. Please try again.');
                    break;
                case 'auth/invalid-email':
                    showError('Invalid email format. Please enter a valid email.');
                    break;
                case 'auth/too-many-requests':
                    showError('Too many failed login attempts. Please try again later or reset your password.');
                    break;
                default:
                    showError('Login failed: ' + error.message);
            }
        });
}


function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
        .then((result) => {
            const user = result.user;
            console.log("Google sign-in successful", user);
            return checkUserExists(user.email);
        })
        .then((userExists) => {
            if (userExists) {
                showSuccess('Logged in successfully with Google');
                currentUser = firebase.auth().currentUser;
                showHome();
            } else {
                // Sign out the user if they don't have an account
                firebase.auth().signOut().then(() => {
                    showError("You haven't created an account yet. Please register first.");
                });
            }
        })
        .catch((error) => {
            console.error("Error during Google sign-in", error);
            showError('Error during Google sign-in: ' + error.message);
        });
}

function checkUserExists(email) {
    return db.collection('users')
        .where('email', '==', email)
        .get()
        .then((querySnapshot) => {
            return !querySnapshot.empty;
        })
        .catch((error) => {
            console.error("Error checking user existence:", error);
            throw error;
        });
}

function checkUserAndRedirect(user) {
    db.collection('users').doc(user.uid).get().then((doc) => {
        if (doc.exists) {
            // User exists in Firestore, proceed to home
            currentUser = user;
            showHome();
        } else {
            // New user, add to Firestore
            return db.collection('users').doc(user.uid).set({
                name: user.displayName,
                email: user.email,
                photoURL: user.photoURL,
                isAdmin: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    }).then(() => {
        if (!doc.exists) {
            currentUser = user;
            showHome();
        }
    }).catch((error) => {
        console.error("Error checking/creating user", error);
        showError('Error during login: ' + error.message);
    });
}

// Add this function to handle image preview
function handleRegisterImagePreview(event) {
    const file = event.target.files[0];
    const preview = document.getElementById('register-image-preview');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" alt="Profile Image Preview">`;
        }
        reader.readAsDataURL(file);
    } else {
        preview.innerHTML = '';
    }
}

// Modify the register function to include image upload

function registerWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
        .then((result) => {
            const user = result.user;
            console.log("Google sign-up successful", user);
            return checkUserExists(user.email);
        })
        .then((userExists) => {
            if (userExists) {
                // Sign out the user if they already have an account
                return firebase.auth().signOut().then(() => {
                    throw new Error("An account with this email already exists. Please log in instead.");
                });
            } else {
                // Create a new user document in Firestore
                return db.collection('users').doc(firebase.auth().currentUser.uid).set({
                    name: firebase.auth().currentUser.displayName,
                    email: firebase.auth().currentUser.email,
                    photoURL: firebase.auth().currentUser.photoURL,
                    isAdmin: false,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        })
        .then(() => {
            showSuccess('Account created successfully with Google');
            currentUser = firebase.auth().currentUser;
            showHome();
        })
        .catch((error) => {
            console.error("Error during Google sign-up", error);
            showError(error.message);
        });
}

function register() {
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const imageFile = document.getElementById('register-image').files[0];

    if (!name || !email || !password) {
        showError('Please fill in all fields');
        return;
    }

    let createdUser;

    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            createdUser = userCredential.user;
            console.log("User registered:", createdUser);
            return createUserProfile(createdUser, name);
        })
        .then(() => {
            console.log("User profile created in Firestore");
            if (imageFile) {
                return uploadProfileImage(createdUser, imageFile);
            }
            return createdUser;
        })
        .then((user) => {
            showSuccess('Registration successful! Welcome to SBJR Agriculture Shop.');
            currentUser = user;
            showHome();
        })
        .catch((error) => {
            console.error("Registration error", error);
            showError('Registration failed: ' + error.message);
            // If user was created but profile creation failed, delete the user
            if (createdUser) {
                createdUser.delete().catch(console.error);
            }
        });
}

function createUserProfile(user, name) {
    return db.collection('users').doc(user.uid).set({
        name: name,
        email: user.email,
        isAdmin: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch((error) => {
        console.error("Error creating user profile:", error);
        throw new Error("Failed to create user profile: " + error.message);
    });
}

// Add this to your DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', () => {
    // ... existing code ...
    
    // Add event listener for register image preview
    document.getElementById('register-image').addEventListener('change', handleRegisterImagePreview);
});

function handleImagePreview(event) {
    const file = event.target.files[0];
    const preview = document.getElementById('image-preview');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" alt="Profile Image Preview" style="max-width: 100%; max-height: 200px;">`;
        }
        reader.readAsDataURL(file);
    } else {
        preview.innerHTML = '';
    }
}

function handleProfileImageChange(event) {
    const file = event.target.files[0];
    if (file) {
        updateProfileImage(file);
    }
}

function logout() {
    console.log("Logout function called");
    auth.signOut().then(() => {
        console.log("User signed out");
        cart = [];
        showSuccess('You have been logged out successfully.');
    }).catch((error) => {
        console.error("Logout error", error);
        showError('Logout failed: ' + error.message);
    });
}

function showHome() {
    console.log("Showing home page");
    if (!currentUser) {
        console.error("No user logged in");
        showError('Please log in to view the home page.');
        return;
    }
    db.collection('users').doc(currentUser.uid).get().then(doc => {
        const userData = doc.data();
        console.log("User data", userData);

        // Fetch featured products
        db.collection('products').limit(3).get().then(querySnapshot => {
            let featuredProducts = '';
            querySnapshot.forEach(doc => {
                const product = doc.data();
                featuredProducts += `
                    <div class="featured-product">
                        <img src="${product.image}" alt="${product.name}" class="featured-product-image">
                        <h3>${product.name}</h3>
                        <p>₹${product.price}</p>
                        <button onclick="showProductDetails('${doc.id}')" class="glow-button">View Details</button>
                    </div>
                `;
            });

            const content = `
                <div class="home-content">
                    <div class="welcome-section">
                        <h2>Welcome to SBJR Agriculture Shop, ${userData.name}!</h2>
                        <p>Discover the best agricultural products for your needs.</p>
                        <div class="scroll-indicator">
                            <p>Scroll to explore and find our location</p>
                            <i class="fas fa-chevron-down"></i>
                        </div>
                    </div>
                    
                    <div class="featured-products">
                        <h2>Featured Products</h2>
                        <div class="featured-products-grid">
                            ${featuredProducts}
                        </div>
                    </div>
                    
                    <div class="about-section">
                        <h2>About SBJR Agriculture Shop</h2>
                        <p>SBJR Agriculture Shop is your one-stop destination for high-quality agricultural products. We offer a wide range of seeds, fertilizers, tools, and equipment to meet all your farming needs.</p>
                        <p>Our mission is to support farmers and agricultural enthusiasts by providing top-notch products and expert advice.</p>
                    </div>
                    
                    <div class="map-section">
                        <div class="map-info">
                            <i class="fas fa-map-marker-alt"></i>
                            <h2>Find Us</h2>
                            <p>Visit our store to see our wide range of products in person. Our knowledgeable staff is ready to assist you!</p>
                        </div>
                        <div id="map">
                            <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d430.8667206686061!2d77.36312548457309!3d30.238965252814257!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x390efd81c34d8d29%3A0x7591a09260058b56!2sAgriculture%20store!5e0!3m2!1sen!2sin!4v1728130861333!5m2!1sen!2sin" width="100%" height="450" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
                        </div>
                    </div>
                    
                    <div class="cta-section">
                        <h2>Start Shopping Now!</h2>
                        <button onclick="showShop()" class="glow-button">Explore Our Products</button>
                    </div>
                </div>
            `;
            document.getElementById('content').innerHTML = content;
        }).catch(error => {
            console.error("Error fetching featured products", error);
            showError('Error loading featured products: ' + error.message);
        });
    }).catch(error => {
        console.error("Error fetching user data", error);
        showError('Error loading home page: ' + error.message);
    });
}

function showShop() {
    console.log("Showing shop page");
    let content = `
        <h2>Shop</h2>
        <div id="search-bar" class="glass-panel">
            <input type="text" id="search-input" placeholder="Search products...">
            <button onclick="searchProducts()" class="glow-button">Search</button>
        </div>
        <div id="product-list" class="product-grid">
        </div>
    `;
    document.getElementById('content').innerHTML = content;
    loadProducts();
}

function loadProducts() {
    console.log("Loading products");
    db.collection('products').get().then((querySnapshot) => {
        let productsHtml = '';
        querySnapshot.forEach((doc) => {
            const product = doc.data();
            productsHtml += createProductCard(doc.id, product);
        });
        document.getElementById('product-list').innerHTML = productsHtml;
    }).catch(error => {
        console.error("Error loading products", error);
        showError('Error loading products: ' + error.message);
    });
}

function createProductCard(id, product) {
    return `
        <div class="product-card">
            <a href="#" onclick="showProductDetails('${id}'); return false;">
                <img src="${product.image}" alt="${product.name}" class="product-image">
                <div class="product-title">${product.name}</div>
                <div class="product-price">₹${product.price}</div>
            </a>
            <button onclick="addToCart('${id}')" class="add-to-cart">Add to Cart</button>
        </div>
    `;
}

function showProductDetails(productId) {
    console.log("Showing product details for", productId);
    db.collection('products').doc(productId).get().then((doc) => {
        if (doc.exists) {
            const product = doc.data();
            const content = `
                <div class="product-details">
                    <div class="product-image-container">
                        <img src="${product.image}" alt="${product.name}" class="product-detail-image">
                    </div>
                    <div class="product-info">
                        <h2>${product.name}</h2>
                        <p class="product-description">${product.description}</p>
                        <p class="product-price">₹${product.price}</p>
                        <button onclick="addToCart('${doc.id}')" class="add-to-cart glow-button">Add to Cart</button>
                        <button onclick="showShop()" class="back-to-shop glow-button">Back to Shop</button>
                    </div>
                </div>
            `;
            document.getElementById('content').innerHTML = content;
        } else {
            showError('Product not found.');
        }
    }).catch((error) => {
        console.error("Error getting product details", error);
        showError('Error loading product details: ' + error.message);
    });
}

function searchProducts() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();
    if (!searchTerm) {
        loadProducts();
        return;
    }
    
    db.collection('products')
        .where('searchTerms', 'array-contains', searchTerm)
        .get()
        .then((querySnapshot) => {
            let productsHtml = '';
            querySnapshot.forEach((doc) => {
                const product = doc.data();
                productsHtml += createProductCard(doc.id, product);
            });
            document.getElementById('product-list').innerHTML = productsHtml || '<p>No products found.</p>';
        })
        .catch((error) => {
            console.error("Error searching products", error);
            showError('Error searching products: ' + error.message);
        });
}

function addToCart(productId) {
    console.log("Adding to cart", productId);
    if (!currentUser) {
        showError('Please log in to add items to your cart.');
        return;
    }
    
    db.collection('products').doc(productId).get().then((doc) => {
        if (doc.exists) {
            const product = doc.data();
            cart.push({id: doc.id, ...product});
            updateCartCount();
            showSuccess('Product added to cart');
        } else {
            showError('Product not found. Please try again.');
        }
    }).catch(error => {
        console.error("Error adding to cart", error);
        showError('Error adding product to cart: ' + error.message);
    });
}

function updateCartCount() {
    document.getElementById('cart-count').textContent = cart.length;
}

function showCart() {
    console.log("Showing cart");
    let content = '<h2>Shopping Cart</h2>';
    if (cart.length === 0) {
        content += '<p>Your cart is empty</p>';
    } else {
        let total = 0;
        content += '<div class="cart-items">';
        cart.forEach((product, index) => {
            const itemTotal = Number(product.price) * product.quantity;
            total += itemTotal;
            content += `
                <div class="cart-item">
                    <img src="${product.image}" alt="${product.name}" class="cart-item-image">
                    <div class="cart-item-details">
                        <h3>${product.name}</h3>
                        <p>Price: ₹${product.price}</p>
                        <div class="quantity-control">
                            <button onclick="updateCartItemQuantity(${index}, -1)" class="quantity-btn">-</button>
                            <span class="quantity">${product.quantity}</span>
                            <button onclick="updateCartItemQuantity(${index}, 1)" class="quantity-btn">+</button>
                        </div>
                        <p>Item Total: ₹${itemTotal.toFixed(2)}</p>
                        <button onclick="removeFromCart(${index})" class="remove-btn">Remove</button>
                    </div>
                </div>
            `;
        });
        content += '</div>';
        content += `<div class="cart-summary">
            <h3>Cart Total: ₹${total.toFixed(2)}</h3>
            <button onclick="checkout()" class="glow-button checkout-btn">Checkout</button>
        </div>`;
    }
    document.getElementById('content').innerHTML = content;
}

function updateCartItemQuantity(index, change) {
    cart[index].quantity += change;
    if (cart[index].quantity < 1) {
        cart.splice(index, 1);
    }
    updateCartCount();
    showCart();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartCount();
    showCart();
}

function addToCart(productId) {
    console.log("Adding to cart", productId);
    if (!currentUser) {
        showError('Please log in to add items to your cart.');
        return;
    }
    
    db.collection('products').doc(productId).get().then((doc) => {
        if (doc.exists) {
            const product = doc.data();
            const existingProductIndex = cart.findIndex(item => item.id === doc.id);
            if (existingProductIndex !== -1) {
                cart[existingProductIndex].quantity += 1;
            } else {
                cart.push({id: doc.id, ...product, quantity: 1});
            }
            updateCartCount();
            showSuccess('Product added to cart');
        } else {
            showError('Product not found. Please try again.');
        }
    }).catch(error => {
        console.error("Error adding to cart", error);
        showError('Error adding product to cart: ' + error.message);
    });
}

function checkout() {
    console.log("Checkout");
    if (cart.length === 0) {
        showError('Your cart is empty. Add some products before checking out.');
        return;
    }
    
    // Generate a random coupon code
    const couponCode = generateCouponCode();
    
    // Calculate total amount
    const totalAmount = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    
    // Save the coupon code to Firebase
    saveCouponToFirebase(couponCode, totalAmount)
        .then(() => {
            // Display the coupon code to the user
            displayCouponCode(couponCode, totalAmount);
        })
        .catch(error => {
            console.error("Error saving coupon", error);
            showError('Error processing checkout: ' + error.message);
        });
}

function generateCouponCode() {
    return 'SBJR-' + Math.random().toString(36).substring(2, 10).toUpperCase();
}

function saveCouponToFirebase(couponCode, amount) {
    return db.collection('coupons').add({
        code: couponCode,
        amount: amount,
        userEmail: currentUser.email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        used: false,
        cartItems: cart.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity
        }))
    });
}

function displayCouponCode(couponCode, amount) {
    let cartItemsHtml = cart.map(item => `
        <li>${item.name} - Quantity: ${item.quantity} - Price: ₹${(item.price * item.quantity).toFixed(2)}</li>
    `).join('');

    let content = `
        <h2>Checkout Complete</h2>
        <p>Your order total: ₹${amount.toFixed(2)}</p>
        <h3>Order Items:</h3>
        <ul>${cartItemsHtml}</ul>
        <p>Here's your coupon code:</p>
        <div class="coupon-code">${couponCode}</div>
        <button onclick="copyCouponCode('${couponCode}')" class="glow-button">Copy Code</button>
        <p>Copy this code to complete your order and empty your cart.</p>
    `;
    document.getElementById('content').innerHTML = content;
}

function copyCouponCode(couponCode) {
    navigator.clipboard.writeText(couponCode).then(() => {
        showSuccess('Coupon code copied to clipboard!');
        // Clear the cart
        cart = [];
        updateCartCount();
        showHome();
    }, (err) => {
        console.error('Could not copy text: ', err);
        showError('Failed to copy coupon code. Please try again.');
    });
}

function showProfile() {
    console.log("Showing profile");
    const content = document.getElementById('content');
    content.innerHTML = '<h2>Loading profile...</h2>';

    if (!currentUser) {
        console.error("No user is currently logged in");
        showError('Please log in to view your profile.');
        return;
    }

    console.log("Current user UID:", currentUser.uid);

    db.collection('users').doc(currentUser.uid).get()
        .then(doc => {
            console.log("Firestore document retrieved:", doc);
            if (doc.exists) {
                const userData = doc.data();
                console.log("User data retrieved:", userData);

                // Check if userData has the necessary fields
                if (!userData.name || !userData.email) {
                    console.warn("User data is incomplete", userData);
                    throw new Error("Incomplete user data");
                }

                const profileHTML = `
                    <div class="profile-container">
            <div class="profile-header">
                <div class="profile-image-container">
                    <img id="profile-image" src="${userData.photoURL || 'https://via.placeholder.com/150'}" alt="Profile Picture">
                    <input type="file" id="profile-image-input" accept="image/*" style="display: none;">
                    <button onclick="document.getElementById('profile-image-input').click()" class="change-image-btn">Change Image</button>
                </div>
                            <div class="profile-name-email">
                                <h2>${userData.name}</h2>
                                <p>${userData.email}</p>
                            </div>
                        </div>
                        <div class="profile-details">
                            <div class="profile-field">
                                <span class="field-label">Name:</span>
                                <span class="field-value">${userData.name}</span>
                                <button onclick="editProfile('name')" class="edit-btn">Edit</button>
                            </div>
                            <div class="profile-field">
                                <span class="field-label">Email:</span>
                                <span class="field-value">${userData.email}</span>
                            </div>
                            <div class="profile-field">
                                <span class="field-label">Password:</span>
                                <span class="field-value">********</span>
                                <button onclick="editProfile('password')" class="edit-btn">Change</button>
                            </div>
                        </div>
                        <div class="profile-coupons">
                            <h3>Your Coupons</h3>
                            <div id="user-coupons">Loading coupons...</div>
                        </div>
                    </div>
                `;
                content.innerHTML = profileHTML;
                document.getElementById('profile-image-input').addEventListener('change', handleProfileImageChange);
                loadUserCoupons();
            } else {
                console.error("No user document found for ID:", currentUser.uid);
                throw new Error("User document not found");
            }
        })
        .catch(error => {
            console.error("Error loading profile:", error);
            showError('Error loading profile: ' + error.message);
            content.innerHTML = `
                <h2>Error Loading Profile</h2>
                <p>We're sorry, but we couldn't load your profile information. This might be because:</p>
                <ul>
                    <li>Your account was not properly set up</li>
                    <li>There was a problem connecting to our database</li>
                    <li>Your session has expired</li>
                </ul>
                <p>Please try logging out and logging back in. If the problem persists, please contact our support team.</p>
                <button onclick="logout()" class="glow-button">Logout</button>
            `;
        });
}

// Modify the loadUserCoupons function
function loadUserCoupons() {
    db.collection('coupons')
        .where('userEmail', '==', currentUser.email)
        .get()
        .then(querySnapshot => {
            let couponsHtml = '<ul class="coupon-list">';
            if (querySnapshot.empty) {
                couponsHtml = '<p>No coupons found.</p>';
            } else {
                querySnapshot.forEach(doc => {
                    const coupon = doc.data();
                    const couponId = doc.id;
                    const createdAt = coupon.createdAt ? coupon.createdAt.toDate() : new Date();
                    const expirationTime = new Date(createdAt.getTime() + 48 * 60 * 60 * 1000); // 48 hours in milliseconds
                    const now = new Date();
                    const isExpired = now > expirationTime || coupon.used;
                    
                    const timeLeft = isExpired ? 'Expired' : getTimeLeft(expirationTime);

                    // Generate a random discount percentage up to 15%
                    const discountPercentage = Math.floor(Math.random() * 15) + 1;

                    couponsHtml += `
                        <li id="coupon-${couponId}" class="coupon-item ${isExpired ? 'expired' : ''}">
                            <span class="coupon-code">${coupon.code}</span>
                            <span class="coupon-discount">${discountPercentage}% OFF</span>
                            <span class="coupon-status">${isExpired ? 'Expired' : 'Available'}</span>
                            <span class="coupon-expiry">${timeLeft}</span>
                            <button onclick="deleteCoupon('${couponId}')" class="delete-btn">Delete</button>
                        </li>
                    `;
                });
                couponsHtml += '</ul>';
            }
            document.getElementById('user-coupons').innerHTML = couponsHtml;
            
            // Update the time every second for non-expired coupons
            if (!querySnapshot.empty) {
                setInterval(() => {
                    querySnapshot.forEach(doc => {
                        const coupon = doc.data();
                        const couponId = doc.id;
                        const createdAt = coupon.createdAt ? coupon.createdAt.toDate() : new Date();
                        const expirationTime = new Date(createdAt.getTime() + 48 * 60 * 60 * 1000);
                        const now = new Date();
                        const isExpired = now > expirationTime || coupon.used;
                        
                        if (!isExpired) {
                            const timeLeft = getTimeLeft(expirationTime);
                            document.querySelector(`#coupon-${couponId} .coupon-expiry`).textContent = timeLeft;
                        }
                    });
                }, 1000);
            }
        })
        .catch(error => {
            console.error("Error loading coupons", error);
            document.getElementById('user-coupons').innerHTML = 'Error loading coupons. Please try again later.';
        });
}

// Update the getTimeLeft function to include seconds
function getTimeLeft(expirationTime) {
    const now = new Date();
    const timeLeft = expirationTime - now;
    
    if (timeLeft <= 0) {
        return 'Expired';
    }

    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    return `${hours}h ${minutes}m ${seconds}s`;
}

function expireCoupon(couponId) {
    const couponElement = document.getElementById(`coupon-${couponId}`);
    if (couponElement) {
        couponElement.classList.add('expired');
        const statusElement = couponElement.querySelector('.coupon-status');
        const expiryElement = couponElement.querySelector('.coupon-expiry');
        if (statusElement) {
            statusElement.textContent = 'Expired';
        }
        if (expiryElement) {
            expiryElement.textContent = 'Expired';
        }
    }
    
    // Update the coupon status in Firebase
    db.collection('coupons').doc(couponId).update({
        used: true
    }).catch(error => {
        console.error("Error updating coupon status", error);
    });
}

// Modify the showUserCoupons function similarly
function showUserCoupons() {
    if (!currentUser) {
        showError('Please log in to view your coupons.');
        return;
    }

    db.collection('coupons')
        .where('userEmail', '==', currentUser.email)
        .get()
        .then(querySnapshot => {
            let couponsHTML = '<h2>Your Coupons</h2>';
            if (querySnapshot.empty) {
                couponsHTML += '<p>You have no coupons.</p>';
            } else {
                couponsHTML += '<ul class="coupon-list">';
                querySnapshot.forEach(doc => {
                    const coupon = doc.data();
                    const couponId = doc.id;
                    const createdAt = coupon.createdAt ? coupon.createdAt.toDate() : new Date();
                    const expirationTime = new Date(createdAt.getTime() + 48 * 60 * 60 * 1000); // 48 hours
                    const now = new Date();
                    const isExpired = now > expirationTime || coupon.used;
                    const timeLeft = isExpired ? 'Expired' : getTimeLeft(expirationTime);

                    // Generate a random discount percentage up to 15%
                    const discountPercentage = Math.floor(Math.random() * 15) + 1;

                    couponsHTML += `
                        <li id="coupon-${couponId}" class="coupon-item ${isExpired ? 'expired' : ''}">
                            <span class="coupon-code">${coupon.code}</span>
                            <span class="coupon-discount">${discountPercentage}% OFF</span>
                            <span class="coupon-info">
                                <span class="coupon-status">${isExpired ? 'Expired' : 'Available'}</span>
                                <span class="coupon-expiry">${timeLeft}</span>
                            </span>
                            <button onclick="deleteCoupon('${couponId}')" class="delete-btn">Delete</button>
                        </li>
                    `;
                });
                couponsHTML += '</ul>';
            }
            couponsHTML += '<button onclick="showProfile()" class="glow-button">Back to Profile</button>';
            document.getElementById('content').innerHTML = couponsHTML;

            // Update the time every second for non-expired coupons
            if (!querySnapshot.empty) {
                setInterval(() => {
                    querySnapshot.forEach(doc => {
                        const coupon = doc.data();
                        const couponId = doc.id;
                        const createdAt = coupon.createdAt ? coupon.createdAt.toDate() : new Date();
                        const expirationTime = new Date(createdAt.getTime() + 48 * 60 * 60 * 1000);
                        const now = new Date();
                        const isExpired = now > expirationTime || coupon.used;
                        
                        if (!isExpired) {
                            const timeLeft = getTimeLeft(expirationTime);
                            document.querySelector(`#coupon-${couponId} .coupon-expiry`).textContent = timeLeft;
                        }
                    });
                }, 1000);
            }
        })
        .catch(error => {
            console.error("Error fetching coupons:", error);
            showError('Error loading coupons. Please try again later.');
        });
}

function editField(field) {
    const fieldValue = document.getElementById(`${field}-value`);
    const currentValue = fieldValue.textContent;
    
    const form = document.createElement('form');
    form.className = 'edit-form';
    form.innerHTML = `
        <input type="${field === 'password' ? 'password' : 'text'}" id="edit-${field}" value="${field === 'password' ? '' : currentValue}" ${field === 'password' ? 'placeholder="New Password"' : ''}>
        <button type="submit">Save</button>
        <button type="button" onclick="cancelEdit()">Cancel</button>
    `;
    
    form.onsubmit = (e) => {
        e.preventDefault();
        const newValue = document.getElementById(`edit-${field}`).value;
        updateProfile({ [field]: newValue });
    };
    
    fieldValue.parentNode.insertBefore(form, fieldValue.nextSibling);
    fieldValue.style.display = 'none';
}

function showReauthenticationForm() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="reauthentication-form">
            <h3>Please re-enter your password to continue</h3>
            <input type="password" id="reauthentication-password" placeholder="Current Password">
            <button onclick="reauthenticateUser()">Confirm</button>
        </div>
    `;
}

function reauthenticateUser() {
    const password = document.getElementById('reauthentication-password').value;
    const credential = firebase.auth.EmailAuthProvider.credential(
        currentUser.email,
        password
    );

    currentUser.reauthenticateWithCredential(credential)
        .then(() => {
            showPasswordChangeForm();
        })
        .catch((error) => {
            showError('Re-authentication failed: ' + error.message);
        });
}

function showPasswordChangeForm() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="password-change-form">
            <h3>Enter your new password</h3>
            <input type="password" id="new-password" placeholder="New Password">
            <input type="password" id="confirm-new-password" placeholder="Confirm New Password">
            <button onclick="changePassword()">Change Password</button>
        </div>
    `;
}

function changePassword() {
    const newPassword = document.getElementById('new-password').value;
    const confirmNewPassword = document.getElementById('confirm-new-password').value;

    if (newPassword !== confirmNewPassword) {
        showError('Passwords do not match');
        return;
    }

    updatePassword(newPassword);
}

function updatePassword(newPassword) {
    currentUser.updatePassword(newPassword)
        .then(() => {
            showSuccess('Password updated successfully');
            showProfile(); // Refresh the profile view
        })
        .catch(error => {
            showError('Error updating password: ' + error.message);
        });
}

function updateField(e, field) {
    e.preventDefault();
    const newValue = document.getElementById(`new-${field}`).value;
    
    if (field === 'password') {
        const confirmPassword = document.getElementById('confirm-password').value;
        if (newValue !== confirmPassword) {
            showError('Passwords do not match');
            return;
        }
        updatePassword(newValue);
    } else {
        updateProfile(field, newValue);
    }
}

function updateProfile(updates) {
    const userRef = db.collection('users').doc(currentUser.uid);

    // Update Firebase Auth profile
    currentUser.updateProfile(updates)
        .then(() => {
            // Update Firestore database
            return userRef.update(updates);
        })
        .then(() => {
            showSuccess('Profile updated successfully');
            showProfile(); // Refresh the profile view
        })
        .catch(error => {
            showError('Error updating profile: ' + error.message);
        });
}

function uploadProfileImage(user, imageFile) {
    return new Promise((resolve, reject) => {
        const storageRef = storage.ref('profile_images/' + user.uid + '/' + imageFile.name);
        
        storageRef.put(imageFile).then(() => {
            return storageRef.getDownloadURL();
        }).then(url => {
            return Promise.all([
                user.updateProfile({photoURL: url}),
                db.collection('users').doc(user.uid).update({photoURL: url})
            ]);
        }).then(() => {
            console.log("Profile image uploaded successfully");
            resolve(user);
        }).catch(error => {
            console.error("Error uploading profile image:", error);
            reject(error);
        });
    });
}

function updateProfileImage(file) {
    const storageRef = storage.ref('profile_images/' + currentUser.uid + '/' + file.name);
    
    storageRef.put(file).then(() => {
        return storageRef.getDownloadURL();
    }).then(url => {
        return Promise.all([
            currentUser.updateProfile({photoURL: url}),
            db.collection('users').doc(currentUser.uid).update({photoURL: url})
        ]);
    }).then(() => {
        showSuccess('Profile image updated successfully');
        // Update the image in the DOM
        document.getElementById('profile-image').src = currentUser.photoURL;
    }).catch(error => {
        console.error("Error updating profile image:", error);
        showError('Error updating profile image: ' + error.message);
    });
}

function updatePassword(newPassword) {
    currentUser.updatePassword(newPassword)
        .then(() => {
            showSuccess('Password updated successfully');
        })
        .catch(error => {
            showError('Error updating password: ' + error.message);
        });
}

function cancelEdit() {
    const form = document.querySelector('.edit-form');
    if (form) {
        const field = form.querySelector('input').id.split('-')[1];
        document.getElementById(`${field}-value`).style.display = '';
        form.remove();
    }
}

function showAdminPanel() {
    console.log("Showing admin panel");
    if (!currentUser) {
        console.error("No user logged in");
        showError('Please log in to access the admin panel.');
        return;
    }
    db.collection('users').doc(currentUser.uid).get().then(doc => {
        if (doc.exists && doc.data().isAdmin) {
            const content = `
                <h2>Admin Panel</h2>
                <button onclick="showAllUsers()" class="glow-button">Show All Users</button>
                 <button onclick="migrateExistingUsers()" class="glow-button">Migrate Existing Users</button>
                <div id="all-users-container"></div>
                <div id="product-form-container">
                    <h3 id="form-title">Add New Product</h3>
                    <form id="add-product-form">
                        <input type="hidden" id="product-id">
                        <input type="text" id="product-name" placeholder="Product Name" required>
                        <textarea id="product-description" placeholder="Product Description" required></textarea>
                        <input type="number" id="product-price" placeholder="Product Price" step="0.01" required>
                        <input type="file" id="product-image" accept="image/*">
                        <div id="current-image-container" style="display: none;">
                            <p>Current Image:</p>
                            <img id="current-image" style="max-width: 200px; margin: 10px 0;">
                        </div>
                        <button type="submit" class="glow-button" id="form-submit-btn">Add Product</button>
                        <button type="button" class="glow-button" id="cancel-edit-btn" style="display: none;" onclick="cancelEdit()">Cancel Edit</button>
                    </form>
                </div>
                <div id="product-list">
                    <h3>Current Products</h3>
                    <ul id="admin-product-list"></ul>
                </div>
            `;
            document.getElementById('content').innerHTML = content;

            document.getElementById('add-product-form').addEventListener('submit', function(e) {
                e.preventDefault();
                const productId = document.getElementById('product-id').value;
                if (productId) {
                    updateProduct(productId);
                } else {
                    addProduct();
                }
            });

            updateAdminProductList();
        } else {
            showError('Access denied. Admin privileges required.');
        }
    }).catch(error => {
        console.error("Error showing admin panel", error);
        showError('Error accessing admin panel: ' + error.message);
    });
}

function showAllUsers() {
    console.log("Showing all users");
    const content = document.getElementById('content');
    content.innerHTML = '<h2>All Users</h2><div id="all-users-container"></div>';
    const usersContainer = document.getElementById('all-users-container');
    usersContainer.innerHTML = '<p>Loading users...</p>';

    db.collection('users').get().then(snapshot => {
        if (snapshot.empty) {
            usersContainer.innerHTML = '<p>No users found.</p>';
            return;
        }

        let usersHTML = `
            <div class="users-table-container">
                <div class="users-table-header">
                    <h3>User List</h3>
                    <button onclick="closeUsersTable()" class="close-button">Close</button>
                </div>
                <table class="users-table">
                    <thead>
                        <tr>
                            <th>Photo</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        snapshot.forEach(doc => {
            const user = doc.data();
            user.id = doc.id;
            usersHTML += `
                <tr id="user-${user.id}">
                    <td><img src="${user.photoURL || 'path/to/default/image.jpg'}" alt="Profile Picture" class="user-profile-picture"></td>
                    <td>${user.name || 'N/A'}</td>
                    <td>${user.email}</td>
                    <td>${user.isAdmin ? 'Admin' : 'Customer'}</td>
                    <td>
                        <button onclick="viewUserDetails('${user.id}')" class="view-btn">View</button>
                        ${!user.isAdmin ? `<button onclick="deleteUser('${user.id}')" class="delete-btn">Delete</button>` : ''}
                    </td>
                </tr>
            `;
        });

        usersHTML += `
                    </tbody>
                </table>
            </div>
        `;

        usersContainer.innerHTML = usersHTML;

        // Add scroll indicator if necessary
        if (snapshot.size > 10) {
            const scrollIndicator = document.createElement('div');
            scrollIndicator.className = 'scroll-indicator';
            scrollIndicator.textContent = 'Scroll to see more users';
            usersContainer.appendChild(scrollIndicator);
        }
    }).catch(error => {
        console.error("Error fetching users:", error);
        usersContainer.innerHTML = '<p>Error loading users. Please try again later.</p>';
    });
}

function viewUserDetails(userId) {
    console.log("Viewing user details", userId);
    db.collection('users').doc(userId).get().then((doc) => {
        if (doc.exists) {
            const userData = doc.data();
            console.log("User data:", userData); // For debugging

            let joinedDate = 'Not available';
            if (userData.createdAt) {
                if (userData.createdAt.toDate) {
                    joinedDate = new Date(userData.createdAt.toDate()).toLocaleDateString();
                } else if (userData.createdAt.seconds) {
                    joinedDate = new Date(userData.createdAt.seconds * 1000).toLocaleDateString();
                }
            }

            const userDetailsHTML = `
                <div class="user-details">
                    <h3>User Details</h3>
                    <img src="${userData.photoURL || 'https://via.placeholder.com/150'}" alt="${userData.name}" class="user-profile-picture-large">
                    <p><strong>Name:</strong> ${userData.name || 'Not available'}</p>
                    <p><strong>Email:</strong> ${userData.email || 'Not available'}</p>
                    <p><strong>Account Type:</strong> ${userData.isAdmin ? 'Admin' : 'Customer'}</p>
                    <p><strong>Joined:</strong> ${joinedDate}</p>
                    ${!userData.isAdmin ? `<button onclick="deleteUser('${doc.id}')" class="delete-btn">Delete User</button>` : ''}
                    <button onclick="showAllUsers()" class="glow-button">Back to User List</button>
                </div>
            `;
            document.getElementById('content').innerHTML = userDetailsHTML;
        } else {
            showError('User not found');
        }
    }).catch((error) => {
        console.error("Error fetching user details", error);
        showError('Error fetching user details: ' + error.message);
    });
}

function migrateExistingUsers() {
    db.collection('users').get().then((snapshot) => {
        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
            const userData = doc.data();
            if (!userData.createdAt) {
                batch.update(doc.ref, {
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        });
        return batch.commit();
    }).then(() => {
        console.log("Migration completed successfully");
        showSuccess("User migration completed successfully");
    }).catch((error) => {
        console.error("Error during migration:", error);
        showError("Error during user migration: " + error.message);
    });
}

function deleteUser(userId) {
    console.log("Deleting user", userId);
    if (confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
        let userEmail;
        let isAdmin;

        db.collection('users').doc(userId).get()
            .then((doc) => {
                if (!doc.exists) {
                    throw new Error("User not found");
                }
                const userData = doc.data();
                userEmail = userData.email;
                isAdmin = userData.isAdmin;

                if (isAdmin) {
                    throw new Error("Cannot delete admin users");
                }

                // Start the deletion process
                showSuccess('Deletion process started. This may take a few moments...');

                // Delete user document
                return db.collection('users').doc(userId).delete();
            })
            .then(() => {
                // Delete user's cart
                return db.collection('carts').doc(userId).delete();
            })
            .then(() => {
                // Delete user's orders
                return db.collection('orders').where('userId', '==', userId).get();
            })
            .then((orderSnapshot) => {
                const batch = db.batch();
                orderSnapshot.forEach((doc) => {
                    batch.delete(doc.ref);
                });
                return batch.commit();
            })
            .then(() => {
                showSuccess('User data has been removed from the system. The user account may still exist in Authentication.');
                
                // Remove the deleted user from the UI immediately
                const userElement = document.getElementById(`user-${userId}`);
                if (userElement) {
                    userElement.remove();
                }

                // Optionally, refresh the entire user list
                // showAllUsers();
            })
            .catch((error) => {
                console.error("Error deleting user", error);
                showError('Error deleting user: ' + error.message);
            });
    }
}

function closeUsersTable() {
    const usersContainer = document.getElementById('all-users-container');
    usersContainer.innerHTML = '';
}

function addProduct() {
    console.log("Adding product");
    const name = document.getElementById('product-name').value.trim();
    const description = document.getElementById('product-description').value.trim();
    const price = document.getElementById('product-price').value;
    const imageFile = document.getElementById('product-image').files[0];
    
    if (!name || !description || !price || !imageFile) {
        showError('Please fill in all fields and select an image.');
        return;
    }
    
    if (isNaN(price) || price <= 0) {
        showError('Please enter a valid price.');
        return;
    }
    
    const storageRef = storage.ref('product-images/' + Date.now() + '_' + imageFile.name);
    storageRef.put(imageFile).then(() => {
        return storageRef.getDownloadURL();
    }).then((url) => {
        return db.collection('products').add({
            name: name,
            description: description,
            price: parseFloat(price).toFixed(2),
            image: url,
            searchTerms: name.toLowerCase().split(' ').concat(description.toLowerCase().split(' '))
        });
    }).then(() => {
        showSuccess('Product added successfully');
        document.getElementById('add-product-form').reset();
        updateAdminProductList();
    }).catch((error) => {
        console.error("Error adding product", error);
        showError('Error adding product: ' + error.message);
    });
}

// Update the updateAdminProductList function to include edit buttons
function updateAdminProductList() {
    console.log("Updating admin product list");
    const list = document.getElementById('admin-product-list');
    list.innerHTML = '';
    db.collection('products').get().then((querySnapshot) => {
        querySnapshot.forEach((doc) => {
            const product = doc.data();
            const li = document.createElement('li');
            li.innerHTML = `
                <img src="${product.image}" alt="${product.name}" style="width: 50px; height: 50px; object-fit: cover;">
                <div class="product-info">
                    <strong>${product.name}</strong> - $${product.price}
                    <p class="product-description">${product.description}</p>
                </div>
                <div class="product-actions">
                    <button onclick="editProduct('${doc.id}')" class="edit-btn">Edit</button>
                    <button onclick="deleteProduct('${doc.id}')" class="delete-btn">Delete</button>
                </div>
            `;
            list.appendChild(li);
        });
    }).catch(error => {
        console.error("Error updating admin product list", error);
        showError('Error updating product list: ' + error.message);
    });
}

function deleteProduct(productId) {
    console.log("Deleting product", productId);
    db.collection('products').doc(productId).delete().then(() => {
        showSuccess('Product deleted successfully');
        updateAdminProductList();
    }).catch((error) => {
        console.error("Error deleting product", error);
        showError('Error deleting product: ' + error.message);
    });
}

// Add new function to handle editing a product
function editProduct(productId) {
    console.log("Editing product", productId);
    
    // Fetch the product data
    db.collection('products').doc(productId).get().then((doc) => {
        if (doc.exists) {
            const product = doc.data();
            
            // Update form title and button
            document.getElementById('form-title').textContent = 'Edit Product';
            document.getElementById('form-submit-btn').textContent = 'Update Product';
            
            // Fill the form with product data
            document.getElementById('product-id').value = productId;
            document.getElementById('product-name').value = product.name;
            document.getElementById('product-description').value = product.description;
            document.getElementById('product-price').value = product.price;
            
            // Show current image
            const currentImageContainer = document.getElementById('current-image-container');
            const currentImage = document.getElementById('current-image');
            currentImageContainer.style.display = 'block';
            currentImage.src = product.image;
            
            // Make image input optional
            document.getElementById('product-image').removeAttribute('required');
            
            // Show cancel button
            document.getElementById('cancel-edit-btn').style.display = 'inline-block';
            
            // Scroll to form
            document.getElementById('product-form-container').scrollIntoView({ behavior: 'smooth' });
        }
    }).catch(error => {
        console.error("Error fetching product for edit", error);
        showError('Error loading product details: ' + error.message);
    });
}

// Add new function to handle updating a product
function updateProduct(productId) {
    console.log("Updating product", productId);
    
    const name = document.getElementById('product-name').value.trim();
    const description = document.getElementById('product-description').value.trim();
    const price = document.getElementById('product-price').value;
    const imageFile = document.getElementById('product-image').files[0];
    
    if (!name || !description || !price) {
        showError('Please fill in all required fields.');
        return;
    }
    
    if (isNaN(price) || price <= 0) {
        showError('Please enter a valid price.');
        return;
    }

    let updatePromise;
    
    if (imageFile) {
        // If new image is provided, upload it first
        const storageRef = storage.ref('product-images/' + Date.now() + '_' + imageFile.name);
        updatePromise = storageRef.put(imageFile)
            .then(() => storageRef.getDownloadURL())
            .then(url => {
                return db.collection('products').doc(productId).update({
                    name: name,
                    description: description,
                    price: parseFloat(price).toFixed(2),
                    image: url,
                    searchTerms: name.toLowerCase().split(' ').concat(description.toLowerCase().split(' '))
                });
            });
    } else {
        // If no new image, just update other fields
        updatePromise = db.collection('products').doc(productId).update({
            name: name,
            description: description,
            price: parseFloat(price).toFixed(2),
            searchTerms: name.toLowerCase().split(' ').concat(description.toLowerCase().split(' '))
        });
    }
    
    updatePromise.then(() => {
        showSuccess('Product updated successfully');
        cancelEdit();
        updateAdminProductList();
    }).catch(error => {
        console.error("Error updating product", error);
        showError('Error updating product: ' + error.message);
    });
}
// Add new function to handle canceling edit
function cancelEdit() {
    // Reset form title and button
    document.getElementById('form-title').textContent = 'Add New Product';
    document.getElementById('form-submit-btn').textContent = 'Add Product';
    
    // Clear form
    document.getElementById('add-product-form').reset();
    document.getElementById('product-id').value = '';
    
    // Hide current image and cancel button
    document.getElementById('current-image-container').style.display = 'none';
    document.getElementById('cancel-edit-btn').style.display = 'none';
    
    // Make image input required again
    document.getElementById('product-image').setAttribute('required', 'required');
}

function showError(message) {
    console.error("Error:", message);
    const messageContainer = document.getElementById('message-container');
    const errorElement = document.createElement('div');
    errorElement.className = 'error message';
    errorElement.textContent = message;
    messageContainer.appendChild(errorElement);
    setTimeout(() => errorElement.remove(), 5000);
}

function showSuccess(message) {
    console.log("Success:", message);
    const messageContainer = document.getElementById('message-container');
    const successElement = document.createElement('div');
    successElement.className = 'success message';
    successElement.textContent = message;
    messageContainer.appendChild(successElement);
    setTimeout(() => successElement.remove(), 5000);
}

function updateSeasonDisplay() {
    const seasonDisplay = document.getElementById('season-display');
    const now = new Date();
    const month = now.getMonth();

    let currentSeason = '';

    // Define seasons based on typical Indian crop cycles
    if (month >= 5 && month <= 8) {  // June to September
        currentSeason = 'Kharif (Monsoon Crop) Season';
    } else if (month >= 9 && month <= 11) {  // October to December
        currentSeason = 'Rabi Crop Sowing Season';
    } else if (month >= 0 && month <= 2) {  // January to March
        currentSeason = 'Rabi Crop Growing Season';
    } else if (month >= 2 && month <= 4) {  // March to May
        currentSeason = 'Rabi Crop Harvesting Season';
    } else if (month === 4 || month === 5) {  // May to June
        currentSeason = 'Kharif Crop Preparation Season';
    }

    // Display the season with scrolling text
    let seasonHTML = `
        <h3>Current Agricultural Season:</h3>
        <div class="scrolling-text-container">
            <div class="scrolling-text">
                ${currentSeason} - Find products suitable for this season!
            </div>
        </div>
    `;

    seasonDisplay.innerHTML = seasonHTML;
}

function showForgotPasswordForm() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('forgot-password-form').style.display = 'block';
}

function showLoginForm() {
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('forgot-password-form').style.display = 'none';
}

function resetPassword() {
    const email = document.getElementById('reset-email').value.trim();
    if (!email) {
        showError('Please enter your email address.');
        return;
    }

    auth.sendPasswordResetEmail(email)
        .then(() => {
            console.log('Password reset email sent successfully');
            showSuccess('Password reset email sent. Please check your inbox and spam folder.');
            showLoginForm();
        })
        .catch((error) => {
            console.error("Password reset error", error);
            showError('Password reset failed: ' + error.message);
        });
}

function loadFeaturedProducts() {
    console.log("Loading featured products");
    const featuredProductsElement = document.getElementById('featured-products');
    if (!featuredProductsElement) {
        console.warn("Featured products element not found in the DOM");
        return;
    }

    db.collection('products').limit(3).get()
        .then((querySnapshot) => {
            let featuredProductsHTML = '<h3>Featured Products</h3>';
            if (querySnapshot.empty) {
                console.log("No featured products found");
                featuredProductsHTML += '<p>No featured products available at the moment.</p>';
            } else {
                featuredProductsHTML += '<div class="product-grid">';
                querySnapshot.forEach((doc) => {
                    const product = doc.data();
                    featuredProductsHTML += `
                        <div class="product-card">
                            <img src="${product.image}" alt="${product.name}" onclick="showProductDetails('${doc.id}')">
                            <h4>${product.name}</h4>
                            <p>₹${product.price}</p>
                            <button onclick="addToCart('${doc.id}')" class="add-to-cart-btn">Add to Cart</button>
                        </div>
                    `;
                });
                featuredProductsHTML += '</div>';
            }
            featuredProductsElement.innerHTML = featuredProductsHTML;
        })
        .catch((error) => {
            console.error("Error loading featured products:", error);
            featuredProductsElement.innerHTML = '<p>Error loading featured products. Please try again later.</p>';
        });
}

// Add this new function to handle coupon deletion
function deleteCoupon(couponId) {
    if (confirm('Are you sure you want to delete this coupon?')) {
        db.collection('coupons').doc(couponId).delete()
            .then(() => {
                showSuccess('Coupon deleted successfully');
                loadUserCoupons(); // Reload the coupons list
            })
            .catch(error => {
                console.error("Error deleting coupon:", error);
                showError('Error deleting coupon. Please try again.');
            });
    }
}

// Modify the showOwnerPanel function
function showOwnerPanel() {
    console.log("Showing owner panel");
    const content = `
        <h2>Owner Information</h2>
        <div class="owner-info">
            <div class="owner-content">
                <div class="owner-image-container" id="tilt-container">
                    <img src="owner_image.jpg" alt="Suraj Bhan Jagdish Rai" class="owner-image" id="tilt-image">
                </div>
                <div class="owner-details">
                    <h3>Suraj Bhan Jagdish Rai</h3>
                    <p>Founder and Owner of SBJR Agriculture Shop</p>
                </div>
            </div>
        </div>
    `;
    document.getElementById('content').innerHTML = content;

    // Call the function to set up the tilt effect after the content is added to the DOM
    setupTiltEffect();
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM content loaded");
    updateCartCount();
    initializeTheme();
    updateSeasonDisplay();
    
    const featuredProductsElement = document.getElementById('featured-products');
    if (featuredProductsElement) {
        loadFeaturedProducts();
    } else {
        console.warn("Featured products element not found in the DOM");
    }
    
    // Make sure this element exists in your HTML
    const profileImageElement = document.getElementById('profile-image');
    if (profileImageElement) {
        profileImageElement.addEventListener('change', handleImagePreview);
    } else {
        console.warn("Profile image element not found in the DOM");
    }
});

function setupTiltEffect() {
    const container = document.getElementById('tilt-container');
    const image = document.getElementById('tilt-image');

    if (!container || !image) return;

    const maxTilt = 10; // Maximum tilt angle in degrees

    container.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const percentX = (x - centerX) / centerX;
        const percentY = -((y - centerY) / centerY); // Invert Y-axis

        const tiltX = maxTilt * percentY;
        const tiltY = maxTilt * percentX;

        image.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(1.05, 1.05, 1.05)`;
    });

    container.addEventListener('mouseleave', () => {
        image.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    });
}
