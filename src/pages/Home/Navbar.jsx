import React from "react";
import { FaVideo } from "react-icons/fa";
import { FiPlusCircle } from "react-icons/fi";
import { FaUserFriends } from "react-icons/fa";
import { Link } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";



const Navbar = () => {


    const roomId = uuidv4().slice(0, 8);
  return (
    <nav>
        <div className="text-center bg-gray-300 mb-2">
            <h1 className="text-2xl font-bold text-black">Video Call</h1>
        </div>
      <div className="h-20 grid grid-cols-4 items-center justify-center">
        <Link to={`/createroom/${roomId}`}>
        <div className="bg-orange-500 h-14 w-14 rounded-md flex  justify-center m-auto items-center">
           <FaVideo className="text-white size-6"/>
        </div>
        </Link>
        <Link to={'/joinroom'}>
        <div className="bg-purple-500 h-14 w-14 rounded-md flex  justify-center mx-auto items-center">
           <FiPlusCircle className="text-white size-6"/>
        </div>
        </Link>
        <Link to={'/friends'}>
        <div className="bg-green-500 h-14 w-14 rounded-md flex justify-center mx-auto items-center">
           <FaUserFriends className="text-white size-6"/>
        </div>
        </Link>
        <div className="bg-blue-500 h-14 w-14 rounded-md flex justify-center mx-auto items-center">
           4
        </div>
        <div className=" h-6 mb-1 flex mt-1  justify-center mx-auto items-center text-sm font-light">
           New meeting
        </div>
        <div className=" h-6 mb-1 flex mt-1  justify-center mx-auto items-center text-sm font-light">
           Join meeting
        </div>
        <div className=" h-6 mb-1 flex mt-1  justify-center mx-auto items-center text-sm font-light">
           Friends
        </div>
      </div>
      <hr className="mt-4"></hr>
    </nav>
  );
};

export default Navbar;
