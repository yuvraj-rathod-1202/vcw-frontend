import React, { useState } from "react";
import { FaGoogle } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuth } from "../../firebase/AuthContext";

const Register = () => {
    const [message, setMessage] = useState("");
    const { registerUser, signInWithGoogle } = useAuth();
    const navigate = useNavigate();

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm();

    const onSubmit = async (data) => {
        console.log(data);

        try {
            await registerUser(data.email, data.password);
            alert("User registered successfully!");
            navigate('/home')
        } catch (error) {
            setMessage("An error occurred during registration.");
            console.error(error);
        }
    };

    const handleGoogleSignIn = async () => {
        try {
            await signInWithGoogle();
            alert("User logged in successfully!");
            navigate('/home');
        } catch (error) {
            setMessage("An error occurred during registration.");
            console.error(error);
        }
    }

    return (
        <div className="h-[calc(100vh-120px)] flex justify-center items-center">
            <div className="w-full max-w-sm mx-auto bg-neutral-100 shadow-md rounded px-8 pt-6 pb-8 mb-4">
                <h2 className="text-xl font-semibold mb-4">Please Register</h2>

                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="mb-4">
                        <label
                            className="block text-gray-700 text-sm font-bold mb-2"
                            htmlFor="email"
                        >
                            Email
                        </label>
                        <input
                            type="email"
                            name="email"
                            id="email"
                            placeholder="Email Address"
                            {...register("email", { required: true })}
                            className="shadow appearance-none border rounded w-full py-2 px-3 leading-tight focus:outline-none focus:shadow"
                        />
                        {errors.email && (
                            <p className="text-red-500 text-xs italic">Email is required.</p>
                        )}
                    </div>
                    <div className="mb-4">
                        <label
                            className="block text-gray-700 text-sm font-bold mb-2"
                            htmlFor="password"
                        >
                            Password
                        </label>
                        <input
                            type="password"
                            name="password"
                            id="password"
                            placeholder="Password"
                            {...register("password", { required: true })}
                            className="shadow appearance-none border rounded w-full py-2 px-3 leading-tight focus:outline-none focus:shadow"
                        />
                        {errors.password && (
                            <p className="text-red-500 text-xs italic">Password is required.</p>
                        )}
                    </div>
                    {message && (
                        <p className="text-red-500 text-xs italic mb-3">{message}</p>
                    )}
                    <div>
                        <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-8 rounded focus:outline-none">
                            Register
                        </button>
                    </div>
                </form>
                <p className="align-baseline font-medium mt-4 text-sm">
                    Have an account? Please{" "}
                    <Link to="/login" className="text-blue-500 hover:text-blue-700">
                        Login
                    </Link>
                </p>

                {/* Google sign-in */}
                <div className="mt-4">
                    <button
                        className="w-full flex gap-2 items-center justify-center bg-gray-300 hover:bg-gray-400 text-black font-bold py-2 px-4 rounded focus:outline-none"
                        onClick={handleGoogleSignIn}>
                        <FaGoogle className="mr-2" />
                        Sign up with Google
                    </button>
                </div>

                <p className="mt-5 text-center text-gray-500 text-xs">
                    ©{new Date().getFullYear()} Video Call App. All rights reserved.
                </p>
            </div>
        </div>
    );
};

export default Register;