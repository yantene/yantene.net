-- CreateTable
CREATE TABLE "Note" (
    "id" BIGSERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "modifiedAt" TIMESTAMP(3) NOT NULL,
    "body" TEXT NOT NULL,
    "insertedAtForAudit" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtForAudit" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteLink" (
    "fromNoteId" BIGINT NOT NULL,
    "toNoteId" BIGINT NOT NULL,
    "insertedAtForAudit" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtForAudit" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoteLink_pkey" PRIMARY KEY ("fromNoteId","toNoteId")
);

-- CreateTable
CREATE TABLE "NoteFile" (
    "id" BIGSERIAL NOT NULL,
    "sha1" BYTEA NOT NULL,
    "uri" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL,
    "insertedAtForAudit" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtForAudit" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoteFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteAttachment" (
    "noteId" BIGINT NOT NULL,
    "noteFileId" BIGINT NOT NULL,
    "insertedAtForAudit" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtForAudit" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoteAttachment_pkey" PRIMARY KEY ("noteId","noteFileId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Note_title_key" ON "Note"("title");

-- CreateIndex
CREATE UNIQUE INDEX "Note_path_key" ON "Note"("path");

-- CreateIndex
CREATE UNIQUE INDEX "NoteFile_sha1_key" ON "NoteFile"("sha1");

-- AddForeignKey
ALTER TABLE "NoteLink" ADD CONSTRAINT "NoteLink_fromNoteId_fkey" FOREIGN KEY ("fromNoteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteLink" ADD CONSTRAINT "NoteLink_toNoteId_fkey" FOREIGN KEY ("toNoteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteAttachment" ADD CONSTRAINT "NoteAttachment_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteAttachment" ADD CONSTRAINT "NoteAttachment_noteFileId_fkey" FOREIGN KEY ("noteFileId") REFERENCES "NoteFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
