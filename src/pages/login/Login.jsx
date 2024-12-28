import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { FaGoogle } from 'react-icons/fa'
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../firebase/AuthContext";

const Login = () => {

    const [message, setMessage] = useState("");
    const { loginUser, signInWithGoogle } = useAuth();
    const navigate = useNavigate();
        const {
            register,
            handleSubmit,
            formState: { errors },
        } = useForm();
    
        const onSubmit = async (data) => {
            console.log(data);
    
            try {
                await loginUser(data.email, data.password);
                alert("User logged in successfully!");
                navigate('/home');
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
            setMessage("An error occurred during login.");
            console.error(error);
        }
    }


    return(
        <div className='h-[calc(100vh-120px)] flex justify-center items-center '>
        <div className='w-full max-w-sm mx-auto bg-neutral-100 shadow-md rounded px-8 pt-6 pb-8 mb-4'>
            <h2 className='text-xl font-semibold mb-4'>Please Login</h2>

            <form onSubmit={handleSubmit(onSubmit)}>
                <div className='mb-4'>
                    <label className='block text-gray-700 text-sm font-bold mb-2' htmlFor="email">Email</label>
                    <input 
                    type="email" name="email" id="email" placeholder='Email Address'
                    {...register("email", { required: true })}
                    className='shadow appearance-none border rounded w-full py-2 px-3 leading-tight focus:outline-none focus:shadow'
                    />
                </div>
                <div className='mb-4'>
                    <label className='block text-gray-700 text-sm font-bold mb-2' htmlFor="password">Password</label>
                    <input 
                    type="password" name="password" id="password" placeholder='Password'
                    {...register("password", { required: true })}
                    className='shadow appearance-none border rounded w-full py-2 px-3 leading-tight focus:outline-none focus:shadow'
                    />
                </div>
                {
                    message && <p className='text-red-500 text-xs italic mb-3'>{message}</p>
                }
                <div>
                    <button className='bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-8 rounded focus:outline-none'>Login </button>
                </div>
            </form>
            <p className='align-baseline font-medium mt-4 text-sm'>Haven't an account? Please <Link to="/register" className='text-blue-500 hover:text-blue-700'>Register</Link></p>

            {/* google sign in */}
            <div className='mt-4'>
                <button 
                className='w-full flex flex-wrap gap-1 items-center justify-center bg-secondary hover:bg-white bg-gray-300 text-black font-bold py-2 px-4 rounded focus:outline-none'
                onClick={handleGoogleSignIn}>
                <FaGoogle  className='mr-2'/>
                Sign in with Google
                </button>
            </div>

            <p className='mt-5 text-center text-gray-500 text-xs'>©2025 Video Call App. All rights reserved.</p>
        </div>
    </div>
    )
}

export default Login;