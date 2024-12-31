import React from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom"; // Use `useNavigate` instead of `Navigate`

const JoinRoom = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm();

  const navigate = useNavigate(); // Correct usage of `useNavigate`

  const onSubmit = (data) => {
    navigate(`/room/${data.roomId}`); // Navigate to the room
    reset(); // Reset the form after navigation
  };

  return (
    <div className="max-w-lg mx-auto md:p-6 p-3 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Join Room</h2>

      {/* Form starts here */}
      <form onSubmit={handleSubmit(onSubmit)} className="">
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700">
            Room ID
            <span className="text-red-500">*</span>
          </label>
          <input
            type="input"
            {...register("roomId", { required: true })}
            className="p-2 border w-full rounded-md focus:outline-none focus:ring focus:border-blue-300"
            placeholder="Enter room ID"
          />
          {errors.roomId && (
            <span className="text-red-500 text-sm">Room ID is required.</span>
          )}
        </div>

        <button
          type="submit"
          className="w-full py-2 bg-green-500 text-white font-bold rounded-md"
        >
          Join Room
        </button>
      </form>
    </div>
  );
};

export default JoinRoom;
