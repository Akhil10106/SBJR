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
    const authToggle = document.getElementById('auth-toggle');

    if (loginForm.style.display !== 'none') {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        authToggle.innerHTML = 'Already have an account? <a href="#" onclick="toggleAuthForm()">Login here</a>';
    } else {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
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

// Listen for auth state changes
auth.onAuthStateChanged(user => {
    console.log("Auth state changed", user);
    if (user) {
        console.log("User is signed in", user);
        currentUser = user;
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('home-container').style.display = 'block';
        checkAdminStatus(user.uid);
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
    
    if (!email || !password) {
        showError('Please enter both email and password.');
        return;
    }
    
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            console.log("Login successful", userCredential.user);
            showSuccess(`Welcome back, ${userCredential.user.email}!`);
            showHome();
        })
        .catch((error) => {
            console.error("Login error", error);
            switch (error.code) {
                case 'auth/user-not-found':
                    showError('No user found with this email. Please check your email or register.');
                    break;
                case 'auth/wrong-password':
                    showError('Incorrect password. Please try again.');
                    break;
                case 'auth/invalid-email':
                    showError('Invalid email format. Please enter a valid email.');
                    break;
                default:
                    showError('Login failed: ' + error.message);
            }
        });
}

async function register() {
    console.log("Register function called");
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const imageFile = document.getElementById('profile-image').files[0];
    
    if (!name || !email || !password) {
        showError('Please fill in all fields.');
        return;
    }
    
    if (password.length < 6) {
        showError('Password must be at least 6 characters long.');
        return;
    }
    
    try {
        // Create user account
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Upload profile image if selected
        let imageUrl = null;
        if (imageFile) {
            const storageRef = storage.ref(`profile_images/${user.uid}`);
            await storageRef.put(imageFile);
            imageUrl = await storageRef.getDownloadURL();
        }

        // Save user data to Firestore
        await db.collection('users').doc(user.uid).set({
            name: name,
            email: email,
            isAdmin: false,
            profileImage: imageUrl
        });

        console.log("User data saved to Firestore");
        showSuccess('Registration successful. You are now logged in.');
        showHome();
    } catch (error) {
        console.error("Registration error", error);
        showError('Registration failed: ' + error.message);
    }
}

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
    
    // Here you would typically process the order, save it to the database, etc.
    // For this example, we'll just clear the cart
    cart = [];
    updateCartCount();
    showSuccess('Order placed successfully! Thank you for your purchase.');
    showHome();
}

function showProfile() {
    console.log("Showing profile");
    if (!currentUser) {
        console.error("No user logged in");
        showError('Please log in to view your profile.');
        return;
    }
    db.collection('users').doc(currentUser.uid).get().then(doc => {
        const userData = doc.data();
        const content = `
            <h2>User Profile</h2>
            <p>Name: ${userData.name}</p>
            <p>Email: ${userData.email}</p>
            <p>Account Type: ${userData.isAdmin ? 'Administrator' : 'Customer'}</p>
        `;
        document.getElementById('content').innerHTML = content;
    }).catch(error => {
        console.error("Error fetching user profile", error);
        showError('Error loading profile: ' + error.message);
    });
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
    const usersContainer = document.getElementById('all-users-container');
    usersContainer.innerHTML = '<h3>Loading users...</h3>';

    db.collection('users').get().then((querySnapshot) => {
        const totalUsers = querySnapshot.size;
        let usersHtml = `
            <div class="users-table-container">
                <div class="users-table-header">
                    <h3>All Users (Total: ${totalUsers})</h3>
                    <button onclick="closeUsersTable()" class="close-button">Close</button>
                </div>
                <table class="users-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Profile Picture</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        querySnapshot.forEach((doc) => {
            const userData = doc.data();
            usersHtml += `
                <tr>
                    <td>${userData.name || 'N/A'}</td>
                    <td>${userData.email || 'N/A'}</td>
                    <td>
                        ${userData.profileImage ? 
                            `<img src="${userData.profileImage}" alt="Profile Picture" class="user-profile-picture" onerror="this.onerror=null; this.src='https://via.placeholder.com/50';">` : 
                            '<img src="https://via.placeholder.com/50" alt="Default Profile Picture" class="user-profile-picture">'}
                    </td>
                </tr>
            `;
        });

        usersHtml += `
                    </tbody>
                </table>
            </div>
        `;

        usersContainer.innerHTML = usersHtml;
    }).catch((error) => {
        console.error("Error fetching users", error);
        usersContainer.innerHTML = '<h3>Error loading users. Please try again.</h3>';
    });
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

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM content loaded");
    updateCartCount();
    initializeTheme(); // Initialize theme when the page loads
    
    // Add this line to set up the image preview
    document.getElementById('profile-image').addEventListener('change', handleImagePreview);
});
