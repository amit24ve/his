// import React, { useState } from "react";

// export default function RegisterForm({ onRegister, onShowLogin }) {
//   const [form, setForm] = useState({ username: "", password: "" });
//   const [showPassword, setShowPassword] = useState(false);

//   const handleChange = (e) => {
//     setForm(f => ({ ...f, [e.target.name]: e.target.value }));
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     if (onRegister) onRegister(form);
//     else alert(`Registered!\nUsername: ${form.username}\nPassword: ${form.password}`);

//     // try{
//     //   const 
//     // }
//   };

//   return (
//     <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-200">
//       <div className="w-full max-w-md mx-auto bg-white shadow-2xl rounded-2xl p-8">
//         <div className="flex flex-col items-center mb-6">

//           <h2 className="text-2xl font-bold text-blue-800 mb-1">
//             Create Account
//           </h2>
//           <p className="text-gray-500 text-sm">Register for CRM access</p>
//         </div>
//         <form className="space-y-5" onSubmit={handleSubmit}>
//           <div>
//             <label className="block text-sm font-medium mb-1 text-gray-700">
//               User Name
//             </label>
//             <input
//               type="text"
//               name="username"
//               autoComplete="username"
//               value={form.username}
//               onChange={handleChange}
//               required
//               className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition"
//               placeholder="Choose a username"
//             />
//           </div>
//           <div>
//             <label className="block text-sm font-medium mb-1 text-gray-700">
//               Password
//             </label>
//             <div className="relative">
//               <input
//                 type={showPassword ? "text" : "password"}
//                 name="password"
//                 autoComplete="new-password"
//                 value={form.password}
//                 onChange={handleChange}
//                 required
//                 className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 pr-10 outline-none transition"
//                 placeholder="Choose a password"
//               />
//               <button
//                 type="button"
//                 tabIndex={-1}
//                 className="absolute right-2 top-2 text-gray-400 hover:text-blue-500"
//                 onClick={() => setShowPassword(v => !v)}
//               >
//                 {showPassword ? (
//                   <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
//                     <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-9-7s4-7 9-7a9.77 9.77 0 014.5 1.125M19.07 13.34A9.993 9.993 0 0021 12c0-3-4-7-9-7a9.77 9.77 0 00-4.5 1.125M3 3l18 18" />
//                   </svg>
//                 ) : (
//                   <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
//                     <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
//                     <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
//                   </svg>
//                 )}
//               </button>
//             </div>
//           </div>
//           <button
//             type="submit"
//             className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg shadow-md transition"
//           >
//             Register
//           </button>
//         </form>
//         <div className="mt-6 text-center">
//           <span className="text-gray-500 text-sm">
//             Already have an account?{" "}
//             <button
//               type="button"
//               className="text-blue-700 font-semibold hover:underline"
//               onClick={onShowLogin}
//             >
//               Login
//             </button>
//           </span>
//         </div>
//       </div>
//     </div>
//   );
// }


import React, { useState } from "react";

export default function RegisterForm({ onShowLogin }) {
  const [form, setForm] = useState({
    username: "",
    email: "",
    fullname: "",
    password: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const formData = new URLSearchParams();
      formData.append("username", form.username);
      formData.append("email", form.email);
      formData.append("fullname", form.fullname);
      formData.append("password", form.password);

      const response = await fetch("https://cubehis.avopay.pro:5000/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: formData.toString()
      });

      const data = await response.json();

      if (response.ok) {
        alert("Registration successful! Please log in.");
        onShowLogin(); // Switch to login screen
      } else {
        setError(data.message || "Registration failed.");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-200">
      <div className="w-full max-w-md mx-auto bg-white shadow-2xl rounded-2xl p-8">
        <div className="flex flex-col items-center mb-6">
          <h2 className="text-2xl font-bold text-blue-800 mb-1">
            Create Account
          </h2>
          <p className="text-gray-500 text-sm">Register for CRM access</p>
        </div>

        {error && <div className="text-red-600 text-sm mb-4 text-center">{error}</div>}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">
              Full Name
            </label>
            <input
              type="text"
              name="fullname"
              value={form.fullname}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded-lg p-2"
              placeholder="Your full name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded-lg p-2"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">
              Username
            </label>
            <input
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded-lg p-2"
              placeholder="Choose a username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg p-2 pr-10"
                placeholder="Choose a password"
              />
              <button
                type="button"
                tabIndex={-1}
                className="absolute right-2 top-2 text-gray-400 hover:text-blue-500"
                onClick={() => setShowPassword(v => !v)}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg shadow-md transition"
          >
            {loading ? "Registering..." : "Register"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <span className="text-gray-500 text-sm">
            Already have an account?{" "}
            <button
              type="button"
              className="text-blue-700 font-semibold hover:underline"
              onClick={onShowLogin}
            >
              Login
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
