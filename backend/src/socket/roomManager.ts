import { AuthenticatedSocket } from './socketAuth';

export const ROOMS = {
  event: (eventId: string) => `event:${eventId}`,
  round: (roundId: string) => `round:${roundId}`,
  student: (studentId: string) => `student:${studentId}`,
  ADMIN: 'admin',
};

export class RoomManager {
  public static joinEventRoom(socket: AuthenticatedSocket, eventId: string) {
    const roomName = ROOMS.event(eventId);
    socket.join(roomName);
  }

  public static joinRoundRoom(socket: AuthenticatedSocket, roundId: string) {
    const roomName = ROOMS.round(roundId);
    socket.join(roomName);
  }

  public static leaveRoundRoom(socket: AuthenticatedSocket, roundId: string) {
    const roomName = ROOMS.round(roundId);
    socket.leave(roomName);
  }

  public static joinStudentRoom(socket: AuthenticatedSocket, studentId: string) {
    const roomName = ROOMS.student(studentId);
    socket.join(roomName);
  }

  public static joinAdminRoom(socket: AuthenticatedSocket) {
    socket.join(ROOMS.ADMIN);
  }
}
