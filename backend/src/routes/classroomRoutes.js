const express = require("express");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const { classroomJoinLimiter } = require("../middleware/rateLimiters");
const { createClassroom , getMyClassrooms , joinClassroom , getClassroomById , updateClassroom , removeStudent , leaveClassroom , deleteClassroom} = require("../controllers/classroomController");

const router = express.Router();

router.post("/", protect, authorizeRoles("teacher"), createClassroom);
router.get("/",protect, authorizeRoles("teacher", "student"), getMyClassrooms);
router.post("/join", classroomJoinLimiter, protect, authorizeRoles("student"), joinClassroom);
router.get("/:id", protect,authorizeRoles("teacher", "student"),getClassroomById);
router.patch("/:id",protect,authorizeRoles("teacher"),updateClassroom);
router.delete("/:id/students/:studentId",protect,authorizeRoles("teacher"),removeStudent);
router.post("/:id/leave",protect,authorizeRoles("student"),leaveClassroom);
router.delete("/:id",protect,authorizeRoles("teacher"),deleteClassroom);

module.exports = router;
